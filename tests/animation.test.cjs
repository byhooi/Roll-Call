const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const APP_SOURCE = readFileSync(join(__dirname, '..', 'js', 'app.js'), 'utf8');

/**
 * 最小可用的 DOM 元素桩，只实现 app.js 渲染路径用到的 API。
 */
function createElement(tagName = 'div') {
    const el = {
        tagName: tagName.toUpperCase(),
        children: [],
        classList: {
            _set: new Set(),
            add(...names) { names.forEach(n => this._set.add(n)); },
            remove(...names) { names.forEach(n => this._set.delete(n)); },
            contains(name) { return this._set.has(name); },
            toggle(name, force) {
                const want = force === undefined ? !this._set.has(name) : force;
                if (want) this._set.add(name); else this._set.delete(name);
                return want;
            }
        },
        attributes: {},
        style: {
            _props: {},
            setProperty(name, value) { this._props[name] = value; }
        },
        textContent: '',
        append(...nodes) { this.children.push(...nodes); nodes.forEach(n => { n.parent = this; }); },
        appendChild(node) { this.append(node); return node; },
        replaceChildren(...nodes) {
            this.children = [];
            this.append(...nodes);
        },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
        removeAttribute(name) { delete this.attributes[name]; },
        querySelectorAll() { return []; }
    };
    return el;
}

function createHarness({ reducedMotion = false } = {}) {
    const frames = [];
    let now = 0;

    const document = {
        readyState: 'loading',
        addEventListener() {},
        createElement,
        createTextNode(text) { return { nodeType: 3, textContent: text }; },
        createDocumentFragment() {
            const fragment = createElement('fragment');
            fragment.isFragment = true;
            return fragment;
        },
        querySelector: () => null
    };

    const context = vm.createContext({
        document,
        console: { log() {}, warn() {}, error() {} },
        window: {
            matchMedia(query) {
                return { matches: reducedMotion && query.includes('prefers-reduced-motion') };
            }
        },
        localStorage: {
            getItem: () => null,
            setItem() {},
            removeItem() {}
        },
        performance: {
            now: () => now
        },
        requestAnimationFrame(callback) {
            frames.push(() => callback(now));
            return frames.length;
        },
        setTimeout: () => 0,
        clearTimeout() {},
        setInterval: () => 1,
        clearInterval() {}
    });

    vm.runInContext(APP_SOURCE, context);
    const app = vm.runInContext('Object.create(RollCallApp.prototype)', context);

    // 手动推进虚拟时钟，按 16ms 一帧执行排队中的帧回调
    const runFrames = (maxFrames = 200) => {
        let count = 0;
        while (frames.length && count < maxFrames) {
            now += 16;
            const next = frames.shift();
            next();
            count++;
        }
        return count;
    };

    return { app, frames, runFrames, createElement, document, fragments: [] };
}

function prepareRollingHarness({ reducedMotion = false, students, count = 1 } = {}) {
    const harness = createHarness({ reducedMotion });
    const { app } = harness;
    app.state = { students, selectedStudent: null, selectedMultiple: [] };
    app.elements = {
        selectedStudent: createElement('div'),
        sound: null
    };
    app.sound = { playTick() {} };
    return harness;
}

test('减少动效时不播放滚动帧，直接进入结果', () => {
    const students = [{ id: '1', name: '张三', seat: 1 }];
    const { app, frames } = prepareRollingHarness({ reducedMotion: true, students });

    let called = false;
    app.startRollingAnimation(1, () => { called = true; });

    // 只渲染一帧后就请求进入结果
    assert.equal(frames.length, 1, '只应排队一次进入结果的帧');
    assert.equal(app.elements.selectedStudent.children.length, 2);
    assert.equal(app.elements.selectedStudent.children[0].textContent, '张三');
    assert.equal(app.elements.selectedStudent.classList.contains('rolling-fast'), false);
});

test('滚动动画复用同一批节点，只更新文本内容', () => {
    const students = [
        { id: '1', name: '张三', seat: 1 },
        { id: '2', name: '李四', seat: 2 },
        { id: '3', name: '王五', seat: 3 }
    ];
    const harness = prepareRollingHarness({ students });
    const { app, runFrames } = harness;

    let called = false;
    app.startRollingAnimation(1, () => { called = true; });

    const box = app.elements.selectedStudent;
    const nameNode = box.children[0];
    const seatNode = box.children[1];

    runFrames();
    assert.equal(called, true, '动画结束后应回调进入结果');
    assert.equal(box.children.length, 2, '动画过程中不应重建节点');
    assert.equal(box.children[0], nameNode, '应复用姓名节点');
    assert.equal(box.children[1], seatNode, '应复用座位节点');
    assert.equal(box.classList.contains('rolling-fast'), false, '结束后应移除抖动类');
});

test('多人滚动只创建一次卡片骨架，数量与抽取人数一致', () => {
    const students = [
        { id: '1', name: '张三', seat: 1 },
        { id: '2', name: '李四', seat: 2 }
    ];
    const harness = prepareRollingHarness({ students, count: 2 });
    const { app, runFrames } = harness;

    app.startRollingAnimation(2, () => {});
    const box = app.elements.selectedStudent;
    const grid = box.children[0];
    assert.equal(grid.className, 'multi-roll-grid');
    assert.equal(grid.children.length, 2);

    const cards = grid.children.slice();
    runFrames();
    assert.equal(box.children[0], grid, '多人模式复用同一个网格节点');
    grid.children.forEach((card, index) => {
        assert.equal(card, cards[index], '卡片节点应被复用');
    });
});

test('滚动期间标记 aria-busy，结束后清除', () => {
    const students = [{ id: '1', name: '张三', seat: 1 }];
    const harness = prepareRollingHarness({ students });
    const { app, runFrames } = harness;

    app.startRollingAnimation(1, () => {});
    assert.equal(app.elements.selectedStudent.getAttribute('aria-busy'), 'true');

    runFrames();
    assert.equal(app.elements.selectedStudent.getAttribute('aria-busy'), null);
});

test('粒子特效在减少动效模式下完全不创建节点', () => {
    const harness = createHarness({ reducedMotion: true });
    const { app, document } = harness;

    const inserted = [];
    const container = createElement('div');
    container.appendChild = node => { inserted.push(node); return node; };
    document.querySelector = () => container;

    app.prefersReducedMotion = () => true;
    app.createParticleExplosion();
    assert.equal(inserted.length, 0, '减少动效时不应创建任何粒子');
});

test('粒子特效通过单个片段批量插入，数量不超过 24', () => {
    const harness = createHarness({ reducedMotion: false });
    const { app, document, fragments } = harness;

    const container = createElement('div');
    container.appendChild = node => { fragments.push(node); return node; };
    container.querySelectorAll = () => [];
    document.querySelector = () => container;

    app.prefersReducedMotion = () => false;
    app.createParticleExplosion();

    assert.equal(fragments.length, 1, '应只向容器插入一个片段，而不是逐个追加粒子');
    const particleCount = fragments[0].children.length;
    assert.equal(particleCount > 0 && particleCount <= 24, true, `粒子数应在 1~24 之间，实际 ${particleCount}`);
    assert.equal(fragments[0].children.every(node => node.className === 'particle'), true);
});

test('prefersReducedMotion 在缺少 matchMedia 时安全回落', () => {
    const harness = createHarness({ reducedMotion: false });
    const { app } = harness;
    assert.equal(app.prefersReducedMotion(), false);
});
