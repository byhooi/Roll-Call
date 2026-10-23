const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function setup() {
    const context = vm.createContext({
        document: { readyState: 'loading', addEventListener() {} }
    });
    vm.runInContext(readFileSync(join(__dirname, '..', 'js', 'app.js'), 'utf8'), context);
    const { app, notifications, dialogs } = vm.runInContext(`({
        app: Object.create(RollCallApp.prototype),
        notifications: NotificationSystem,
        dialogs: DialogService
    })`, context);
    const messages = [];
    for (const type of ['error', 'success', 'info']) {
        notifications[type] = message => messages.push({ type, message });
    }
    app.loadInitialData = () => {};
    app.updateUI = () => {};
    app.updateCurrentTab = () => {};
    return { app, dialogs, messages };
}

for (const confirmed of [true, false]) {
    test(`导入确认前关闭加载层，${confirmed ? '确认后保存' : '取消不保存'}`, async () => {
        const { app, dialogs } = setup();
        let loading = false;
        let writes = 0;
        app.elements = { importExcel: { value: '名单.xlsx' } };
        app.showLoading = () => { loading = true; };
        app.hideLoading = () => { loading = false; };
        app.buildImportValidationMessage = () => '座位号过高';
        app.excel = {
            importStudentsFromExcel: async () => ({ students: [], count: 0 }),
            validateStudentData: () => ({ issues: [{}], errors: [], warnings: [{}] })
        };
        app.storage = { saveStudents: () => { writes++; return true; } };
        dialogs.confirm = async () => {
            assert.equal(loading, false, '确认框出现时不能有加载遮罩');
            return confirmed;
        };
        await app.handleImportExcel({});
        assert.equal(writes, confirmed ? 1 : 0);
        assert.equal(loading, false);
        assert.equal(app.elements.importExcel.value, '');
    });
}

test('编辑保存失败提示错误并保留表单', async () => {
    const { app, messages } = setup();
    app.elements = {
        editStudentId: { value: '1' },
        editStudentName: { value: '张三' },
        editStudentSeat: { value: '2' }
    };
    app.storage = { editStudent: () => false };
    app.hideEditStudentModal = () => assert.fail('保存失败不能关闭表单');
    await app.handleEditStudent();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'error');
    assert.match(messages[0].message, /未保存/);
    assert.equal(app.elements.editStudentName.value, '张三');
});

for (const outcome of ['success', 'failure', 'empty']) {
    test(`点名结果状态与 ${outcome} 一致，并恢复按钮`, () => {
        const { app, messages } = setup();
        const student = { id: '1', name: '张三', callCount: 1 };
        const attributes = {};
        app.state = { students: [student], rollCount: 1 };
        app.elements = {
            rollBtn: {
                disabled: false,
                classList: { add() {}, remove() {} },
                removeAttribute(name) { delete attributes[name]; },
                setAttribute(name, value) { attributes[name] = value; }
            },
            rollStatus: {
                setAttribute(name, value) { this[name] = value; },
                getAttribute(name) { return this[name]; }
            }, selectedStudent: {}, studentInfo: {}
        };
        app.startRollingAnimation = (count, callback) => callback();
        app.algorithm = { rollCall() {
            if (outcome === 'failure') throw new Error('保存失败');
            return outcome === 'empty' ? null : student;
        } };
        // refreshUI 负责数据与界面刷新，这里只验证调用时机，不渲染真实 DOM
        app.loadInitialData = () => {};
        app.updateUI = () => {};
        app.showSelectedStudents = () => {};
        app.sound = { playWin() {} };
        app.voice = { speak() {} };
        app.handleRollCall();
        assert.equal(app.elements.rollBtn.disabled, false);
        assert.equal(attributes['aria-busy'], undefined, '结束点名后应移除忙碌标记');
        if (outcome === 'success') {
            assert.equal(app.elements.rollStatus.className, 'status-badge completed');
            assert.equal(app.elements.rollStatus.textContent, '点名完成');
            assert.equal(app.elements.rollStatus.getAttribute('aria-live'), 'polite');
            assert.equal(messages.length, 0);
        } else {
            assert.equal(app.elements.rollStatus.className, 'status-badge failed');
            assert.equal(app.elements.rollStatus.textContent, '点名失败，请重试');
            assert.equal(app.state.selectedStudent, null);
            assert.equal(app.state.selectedMultiple.length, 0);
            assert.equal(messages[0].type, 'error');
        }
    });
}

test('点名进行中按钮带忙碌标记，状态徽标具备读屏播报语义', () => {
    const { app } = setup();
    const attributes = {};
    const student = { id: '1', name: '张三', callCount: 1 };
    app.state = { students: [student], rollCount: 1, dirtyTabs: new Set() };
    app.elements = {
        rollBtn: {
            disabled: false,
            classList: { add() {}, remove() {} },
            removeAttribute(name) { delete attributes[name]; },
            setAttribute(name, value) { attributes[name] = value; }
        },
        rollStatus: {
            textContent: '',
            className: '',
            setAttribute(name, value) { this[name] = value; }
        },
        selectedStudent: {},
        studentInfo: {}
    };
    let sawBusy = false;
    app.startRollingAnimation = (count, callback) => {
        sawBusy = attributes['aria-busy'] === 'true'
            && app.elements.rollStatus.textContent === '点名进行中...'
            && app.elements.rollStatus.className === 'status-badge rolling';
        callback();
    };
    app.algorithm = { rollCall: () => student };
    app.loadInitialData = () => {};
    app.updateUI = () => {};
    app.showSelectedStudents = () => {};
    app.sound = { playWin() {} };
    app.voice = { speak() {} };
    app.handleRollCall();
    assert.equal(sawBusy, true, '滚动期间应处于忙碌状态');
});

test('refreshUI 只渲染当前标签页，隐藏页面留待切回时刷新', () => {
    // setup() 会把 updateCurrentTab 置空，这里需要真实的标签页分发逻辑
    const context = vm.createContext({
        document: { readyState: 'loading', addEventListener() {} }
    });
    vm.runInContext(readFileSync(join(__dirname, '..', 'js', 'app.js'), 'utf8'), context);
    const app = vm.runInContext('Object.create(RollCallApp.prototype)', context);
    const rendered = [];
    app.state = { activeTab: 'roll-call', dirtyTabs: new Set() };
    app.loadInitialData = () => rendered.push('load');
    app.updateUI = () => rendered.push('ui');
    // 通过 updateStatisticsTab 观察统计页是否被渲染
    app.updateStatisticsTab = () => rendered.push('statistics');

    app.refreshUI();
    assert.deepEqual(rendered, ['load', 'ui'], '点名页不应重建隐藏的管理/统计页');
    assert.equal(app.state.dirtyTabs.has('students'), true);
    assert.equal(app.state.dirtyTabs.has('statistics'), true);

    app.state.activeTab = 'statistics';
    app.refreshUI();
    assert.deepEqual(rendered, ['load', 'ui', 'load', 'ui', 'statistics']);
    assert.equal(app.state.dirtyTabs.has('statistics'), false);
    assert.equal(app.state.dirtyTabs.has('students'), true);
});
