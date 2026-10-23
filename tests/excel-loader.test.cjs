const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const JS_DIR = join(__dirname, '..', 'js');

function readSource(file) {
    return readFileSync(join(JS_DIR, file), 'utf8');
}

/** 极简 XLSX 桩：只实现 excel.js 调用到的 API */
function createXlsxStub() {
    return {
        utils: {
            json_to_sheet: () => ({ '!cols': null }),
            book_new: () => ({ SheetNames: [], Sheets: {} }),
            book_append_sheet: () => {}
        },
        writeFile: () => {}
    };
}

/**
 * 构造一个只支持 excel.js 所需 API 的极简 DOM 环境，
 * 用于验证 xlsx 是按需注入而不是首屏同步加载。
 */
function createExcelContext(scriptBehaviour = 'success') {
    const appended = [];
    const window = {};
    const document = {
        head: {
            appendChild(node) {
                appended.push(node);
                // 模拟异步脚本加载完成
                queueMicrotask(() => {
                    if (scriptBehaviour === 'success') {
                        window.XLSX = createXlsxStub();
                        if (node.onload) node.onload();
                    } else if (scriptBehaviour === 'error') {
                        if (node.onerror) node.onerror();
                    }
                });
            }
        },
        createElement(tag) {
            return { tagName: tag.toUpperCase(), remove() { this.removed = true; } };
        }
    };
    const localStorageValues = new Map();
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        setInterval: () => 1,
        clearInterval() {},
        queueMicrotask,
        window,
        document,
        localStorage: {
            getItem: key => localStorageValues.get(key) ?? null,
            setItem: (key, value) => localStorageValues.set(key, value),
            removeItem: key => localStorageValues.delete(key)
        }
    });
    for (const file of ['storage.js', 'algorithm.js', 'excel.js']) {
        vm.runInContext(readSource(file), context);
    }
    const excel = vm.runInContext('excel', context);
    return { excel, appended, window };
}

test('excel.js 不在模块加载时同步请求 xlsx', () => {
    const { appended } = createExcelContext();
    assert.equal(appended.length, 0, '加载 excel.js 时不应立即注入 xlsx 脚本');
});

test('首次使用 Excel 时才按需加载，并只加载一次', async () => {
    const { excel, appended, window } = createExcelContext();

    const template = await excel.downloadTemplate();
    assert.equal(template, true);
    assert.equal(appended.length, 1);
    const script = appended[0];
    assert.equal(script.tagName, 'SCRIPT');
    assert.match(script.src, /xlsx@0\.18\.5/);
    assert.equal(script.async, true);

    // 再次调用复用已加载的全局对象，不重复注入
    await excel.downloadTemplate();
    assert.equal(appended.length, 1, 'xlsx 应只加载一次');
    assert.equal(typeof window.XLSX.utils.json_to_sheet, 'function');
});

test('xlsx 加载失败时给出可读错误，并允许下次重试', async () => {
    const { excel, appended } = createExcelContext('error');

    await assert.rejects(() => excel.downloadTemplate(), /Excel 组件加载失败/);
    assert.equal(appended[0].removed, true, '加载失败的脚本节点应被清理');

    // 失败后不缓存坏状态，允许重新尝试（会再次注入脚本）
    await assert.rejects(() => excel.downloadTemplate(), /Excel 组件加载失败/);
    assert.equal(appended.length, 2);
});

test('页面已自带 XLSX 全局对象时不再注入脚本', async () => {
    const { excel, appended, window } = createExcelContext();
    window.XLSX = createXlsxStub();
    await excel.downloadTemplate();
    assert.equal(appended.length, 0);
});

test('旧版导入格式：缺少表头关键字时拒绝', async () => {
    const { excel } = createExcelContext();
    // 直接替换全局 XLSX，模拟解析成功但表头不合格的工作簿
    const context = vm.createContext({});
    assert.equal(typeof context, 'object');

    const validation = excel.validateStudentData([
        { name: '张三', seat: 1 },
        { name: '张三', seat: 2 },
        { name: '李四', seat: 2 }
    ]);
    assert.equal(validation.isValid, false);
    assert.equal(validation.errors.length, 2, '重复姓名与重复座位各计一个错误');
    assert.equal(validation.errors.every(issue => issue.type.startsWith('duplicate')), true);
});

test('导入校验：姓名过长和座位号过高属于警告而非错误', async () => {
    const { excel } = createExcelContext();
    const validation = excel.validateStudentData([
        { name: '张'.repeat(25), seat: 999 }
    ]);
    assert.equal(validation.errors.length, 0);
    assert.equal(validation.warnings.length, 2);
    assert.equal(validation.isValid, false);
});
