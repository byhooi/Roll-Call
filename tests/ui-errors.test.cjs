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
        app.state = { students: [student], rollCount: 1 };
        app.elements = {
            rollBtn: {
                disabled: false,
                classList: { add() {}, remove() {} },
                removeAttribute() {}
            },
            rollStatus: {}, selectedStudent: {}, studentInfo: {}
        };
        app.startRollingAnimation = (count, callback) => callback();
        app.algorithm = { rollCall() {
            if (outcome === 'failure') throw new Error('保存失败');
            return outcome === 'empty' ? null : student;
        } };
        app.showSelectedStudents = () => {};
        app.sound = { playWin() {} };
        app.voice = { speak() {} };
        app.handleRollCall();
        assert.equal(app.elements.rollBtn.disabled, false);
        if (outcome === 'success') {
            assert.equal(app.elements.rollStatus.className, 'status-badge completed');
            assert.equal(app.elements.rollStatus.textContent, '点名完成');
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
