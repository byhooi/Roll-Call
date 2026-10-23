// 用无头 Edge 的 DevTools 协议验证页面：加载首页、执行交互、收集报错。
// 不依赖任何 npm 包，仅使用 Node 内置的 http / WebSocket 客户端能力。
// 用法：先启动静态服务器（默认 8123），再运行 `node tests/manual/browser-check.cjs`。
// 浏览器路径可用环境变量 EDGE_PATH 覆盖；未设置时按平台常见安装位置自动探测。
const http = require('http');
const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const PORT = 9333;
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8123/';

const EDGE_CANDIDATES = [
    join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    // 非 Windows 平台的常见位置
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome'
];

function resolveBrowser() {
    if (process.env.EDGE_PATH) return process.env.EDGE_PATH;
    const found = EDGE_CANDIDATES.find(candidate => candidate && existsSync(candidate));
    if (!found) {
        throw new Error('未找到 Edge/Chrome，请通过环境变量 EDGE_PATH 指定浏览器可执行文件路径');
    }
    return found;
}

const EDGE = resolveBrowser();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(path) {
    return new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: PORT, path }, res => {
            let body = '';
            res.on('data', d => { body += d; });
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body)); }
            });
        }).on('error', reject);
    });
}

// 最小 WebSocket 客户端（仅文本帧，客户端需掩码）
function connect(wsUrl) {
    return new Promise((resolve, reject) => {
        const net = require('net');
        const crypto = require('crypto');
        const { URL } = require('url');
        const u = new URL(wsUrl);
        const key = crypto.randomBytes(16).toString('base64');
        const socket = net.connect(Number(u.port), u.hostname, () => {
            socket.write(
                `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
                `Host: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
                `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
            );
        });
        let buffer = Buffer.alloc(0);
        let upgraded = false;
        const listeners = [];
        const send = text => {
            const payload = Buffer.from(text);
            const mask = crypto.randomBytes(4);
            const masked = Buffer.alloc(payload.length);
            for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
            let header;
            if (payload.length < 126) {
                header = Buffer.from([0x81, 0x80 | payload.length]);
            } else if (payload.length < 65536) {
                header = Buffer.alloc(4);
                header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2);
            } else {
                header = Buffer.alloc(10);
                header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2);
            }
            socket.write(Buffer.concat([header, mask, masked]));
        };
        socket.on('data', chunk => {
            buffer = Buffer.concat([buffer, chunk]);
            if (!upgraded) {
                const idx = buffer.indexOf('\r\n\r\n');
                if (idx === -1) return;
                upgraded = true;
                buffer = buffer.slice(idx + 4);
                resolve({ send, onMessage: fn => listeners.push(fn), close: () => socket.destroy() });
            }
            while (buffer.length >= 2) {
                const len0 = buffer[1] & 0x7f;
                let offset = 2;
                let len = len0;
                if (len0 === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); offset = 4; }
                else if (len0 === 127) { if (buffer.length < 10) return; len = Number(buffer.readBigUInt64BE(2)); offset = 10; }
                if (buffer.length < offset + len) return;
                const text = buffer.slice(offset, offset + len).toString();
                buffer = buffer.slice(offset + len);
                listeners.forEach(fn => fn(text));
            }
        });
        socket.on('error', reject);
    });
}

(async () => {
    const edge = spawn(EDGE, [
        '--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu',
        '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + require('path').join(require('os').tmpdir(), 'rc-edge-profile'),
        'about:blank'
    ], { stdio: 'ignore' });

    try {
        let targets = null;
        for (let i = 0; i < 60; i++) {
            try { targets = await getJSON('/json/list'); if (targets.length) break; } catch (e) {}
            await sleep(250);
        }
        if (!targets || !targets.length) throw new Error('无法连接无头浏览器调试端口');

        const page = targets.find(t => t.type === 'page') || targets[0];
        const ws = await connect(page.webSocketDebuggerUrl);

        let id = 0;
        const pending = new Map();
        const consoleErrors = [];
        const pageErrors = [];

        ws.onMessage(raw => {
            const msg = JSON.parse(raw);
            if (msg.id && pending.has(msg.id)) {
                pending.get(msg.id)(msg);
                pending.delete(msg.id);
            }
            if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
                consoleErrors.push(msg.params.args.map(a => a.value ?? a.description).join(' '));
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
            }
        });

        const send = (method, params = {}) => new Promise(resolve => {
            const msgId = ++id;
            pending.set(msgId, resolve);
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });

        await send('Runtime.enable');
        await send('Page.enable');
        await send('Page.navigate', { url: URL });
        await sleep(1500);

        const evaluate = async expression => {
            const res = await send('Runtime.evaluate', {
                expression, returnByValue: true, awaitPromise: true
            });
            if (res.result?.exceptionDetails) {
                throw new Error(res.result.exceptionDetails.exception?.description || 'evaluate failed');
            }
            return res.result?.result?.value;
        };

        const report = {};
        report.title = await evaluate('document.title');
        report.hasApp = await evaluate('typeof window.app === "object" && window.app !== null');
        report.excelGlobalScope = await evaluate('typeof excel');
        report.xlsxLoadedOnBoot = await evaluate('typeof window.XLSX !== "undefined"');
        report.scriptTags = await evaluate('[...document.querySelectorAll("script[src]")].map(s => s.getAttribute("src"))');
        report.googleFonts = await evaluate('[...document.querySelectorAll("link")].some(l => (l.href||"").includes("fonts.googleapis"))');

        // 录入示例名单并点名
        report.overflowBefore = await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1');
        await evaluate('window.app.storage.saveStudents(window.app.excel.getSampleStudents(), { resetHistory: true, resetStats: true }); window.app.refreshUI(); "ok"');
        report.studentCount = await evaluate('window.app.storage.getStudents().length');

        await evaluate(`new Promise(resolve => {
            const btn = document.getElementById('roll-btn');
            btn.click();
            const start = Date.now();
            const timer = setInterval(() => {
                if (!btn.disabled || Date.now() - start > 5000) { clearInterval(timer); resolve(); }
            }, 50);
        })`);
        await sleep(200);
        report.callsAfterRoll = await evaluate('window.app.algorithm.getTotalCalls()');
        report.resultText = await evaluate('document.getElementById("selected-student").textContent.replace(/\\s+/g, " ").trim()');
        report.statusText = await evaluate('document.getElementById("roll-status").textContent');

        // 切换到管理页与统计页，确认惰性渲染生效
        await evaluate('window.app.switchTab("students"); "ok"');
        report.tableRows = await evaluate('document.querySelectorAll("#students-tbody tr").length');
        await evaluate('window.app.switchTab("statistics"); "ok"');
        report.statCards = await evaluate('document.querySelectorAll("#stats-grid .stat-item-card").length');
        report.distributionChips = await evaluate('document.querySelectorAll("#distribution-bar .distribution-chip").length');

        // 多人点名
        await evaluate('window.app.switchTab("roll-call"); window.app.setRollMode(5); "ok"');
        await evaluate(`new Promise(resolve => {
            const btn = document.getElementById('roll-btn');
            btn.click();
            const start = Date.now();
            const timer = setInterval(() => {
                if (!btn.disabled || Date.now() - start > 5000) { clearInterval(timer); resolve(); }
            }, 50);
        })`);
        report.multiCards = await evaluate('document.querySelectorAll("#selected-student .multi-student-card").length');

        report.hasHorizontalOverflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth + 1');
        report.consoleErrors = consoleErrors;
        report.pageErrors = pageErrors;

        // 移动端视口：检查表格可横向滚动且页面本身不产生横向溢出
        await send('Emulation.setDeviceMetricsOverride', {
            width: 375, height: 812, deviceScaleFactor: 2, mobile: true
        });
        await sleep(400);
        await evaluate('window.app.switchTab("students"); "ok"');
        report.mobile = await evaluate(`(() => {
            const doc = document.documentElement;
            const table = document.getElementById('table-drop-zone');
            return {
                pageOverflow: doc.scrollWidth > window.innerWidth + 1,
                viewportWidth: window.innerWidth,
                tableScrollable: table ? getComputedStyle(table).overflowX : null,
                chipMinHeight: (() => {
                    const chip = document.querySelector('.mode-chip');
                    return chip ? getComputedStyle(chip).minHeight : null;
                })()
            };
        })()`);

        // 减少动效偏好：确认媒体查询生效且粒子不创建
        await send('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
        });
        report.reducedMotion = await evaluate(`(() => ({
            matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            appDetects: window.app.prefersReducedMotion()
        }))()`);

        // Excel 按需加载：调用后再检查 XLSX 是否已注入
        report.xlsxBeforeUse = await evaluate('typeof window.XLSX !== "undefined"');
        await evaluate('window.app.excel.getSampleStudents().length > 0');
        await evaluate('window.app.excel.downloadTemplate().then(() => "ok").catch(e => "ERR:" + e.message)');
        report.xlsxAfterTemplate = await evaluate('typeof window.XLSX !== "undefined"');
        report.xlsxScriptInDom = await evaluate('[...document.querySelectorAll("script[src]")].some(s => s.src.includes("xlsx"))');

        console.log(JSON.stringify(report, null, 2));
        ws.close();
    } finally {
        edge.kill();
    }
})().catch(err => {
    console.error('FATAL', err.message);
    process.exit(1);
});
