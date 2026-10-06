const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function setup() {
    const values = new Map();
    const writes = [];
    let fail = false;
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        setInterval: () => 1,
        clearInterval() {},
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem(key, value) {
                if (fail) throw new Error('存储不可用');
                values.set(key, value);
                writes.push(key);
            },
            removeItem: key => values.delete(key)
        }
    });
    for (const file of ['storage.js', 'algorithm.js']) {
        vm.runInContext(readFileSync(join(__dirname, '..', 'js', file), 'utf8'), context);
    }
    const { storage, algorithm } = vm.runInContext('({ storage, algorithm })', context);
    return { storage, algorithm, values, writes, fail: () => { fail = true; } };
}

test('点名一次提交并返回更新后的次数，刷新后仍保留', () => {
    const { storage, algorithm, writes } = setup();
    storage.addStudent({ name: '张三', seat: 1 });
    writes.length = 0;
    const result = algorithm.rollCall();
    assert.equal(writes.length, 1);
    assert.equal(result.callCount, 1);
    assert.equal(storage.getStudentById(result.id), result);
    assert.equal(storage.getCallHistory()[0].timestamp, result.lastCall);
    storage.reloadCache();
    assert.equal(storage.getStudents()[0].callCount, 1);
    assert.equal(algorithm.getStudentStats().totalCalls, 1);
});

test('公平点名保持次数差不超过一，总次数不受历史上限影响', () => {
    const { storage, algorithm } = setup();
    for (let seat = 1; seat <= 7; seat++) storage.addStudent({ name: `学生${seat}`, seat });
    for (let count = 0; count < 1010; count++) algorithm.rollCall();
    const counts = storage.getStudents().map(student => student.callCount);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
    assert.equal(storage.getCallHistory().length, 1000);
    assert.equal(algorithm.getStudentStats().totalCalls, 1010);
});

test('旧数据按学生次数恢复超过历史上限的汇总', () => {
    const { storage, algorithm } = setup();
    storage.addStudent({ name: '张三', seat: 1 });
    storage.updateStudent(storage.getStudents()[0].id, { callCount: 1200 });
    storage.updateStats({ totalCalls: 1000 });
    assert.equal(algorithm.rollCall().callCount, 1201);
    assert.equal(algorithm.getStudentStats().totalCalls, 1201);
});

test('点名保存失败不更新次数、历史与索引', () => {
    const fixture = setup();
    fixture.storage.addStudent({ name: '张三', seat: 1 });
    const id = fixture.storage.getStudents()[0].id;
    fixture.fail();
    assert.throws(() => fixture.algorithm.rollCall(), /保存失败/);
    assert.equal(fixture.storage.getStudentById(id).callCount, 0);
    assert.equal(fixture.storage.getCallHistory().length, 0);
    assert.equal(fixture.storage.getStats().totalCalls, 0);
});

test('增删保存失败后索引与持久化数据保持一致', () => {
    const fixture = setup();
    fixture.storage.addStudent({ name: '张三', seat: 1 });
    const id = fixture.storage.getStudents()[0].id;
    fixture.fail();
    assert.equal(fixture.storage.deleteStudent(id), false);
    assert.equal(fixture.storage.getStudentById(id).name, '张三');
    assert.equal(fixture.storage.addStudent({ name: '李四', seat: 2 }), false);
    assert.equal(fixture.storage.getStudentBySeat(2), null);
    assert.equal(fixture.storage.getStudents().length, 1);
});

test('拒绝重复姓名、座位以及非正整数座位', () => {
    const { storage } = setup();
    storage.addStudent({ name: '张三', seat: 1 });
    assert.throws(() => storage.addStudent({ name: ' 张三 ', seat: 2 }), /已存在/);
    assert.throws(() => storage.addStudent({ name: '李四', seat: 1 }), /已存在/);
    for (const seat of [0, -1, 1.5, NaN, Infinity]) {
        assert.throws(() => storage.addStudent({ name: '李四', seat }), /正整数/);
    }
    assert.equal(storage.getStudents().length, 1);
});

test('重置周期一次提交，失败时保留原数据', () => {
    const fixture = setup();
    fixture.storage.addStudent({ name: '张三', seat: 1 });
    fixture.algorithm.rollCall();
    fixture.writes.length = 0;
    fixture.algorithm.resetAllCallCounts();
    assert.equal(fixture.writes.length, 1);
    assert.equal(fixture.storage.getStudents()[0].callCount, 0);
    assert.equal(fixture.storage.getCallHistory().length, 0);
    assert.equal(fixture.storage.getStats().totalCalls, 0);
    fixture.algorithm.rollCall();
    fixture.fail();
    assert.throws(() => fixture.algorithm.resetAllCallCounts(), /保存失败/);
    assert.equal(fixture.storage.getStudents()[0].callCount, 1);
    assert.equal(fixture.storage.getCallHistory().length, 1);
});

test('自动备份跳过未变化的数据，变化后重新备份', () => {
    const { storage, algorithm, writes } = setup();
    storage.addStudent({ name: '张三', seat: 1 });
    storage.createAutoBackup();
    writes.length = 0;
    storage.saveAllData(storage.getAllData());
    storage.createAutoBackup();
    assert.equal(writes.filter(key => key === storage.backupKey).length, 0);
    algorithm.rollCall();
    storage.createAutoBackup();
    assert.equal(writes.filter(key => key === storage.backupKey).length, 1);
});

test('大名单候选选择不受函数参数数量限制', () => {
    const { algorithm } = setup();
    const students = Array.from({ length: 150000 }, (_, id) => ({ id, callCount: id === 1 ? 0 : 1 }));
    assert.equal(algorithm.getLeastCalledGroup(students)[0].id, 1);
    assert.equal(algorithm.getLeastCalledGroup([]).length, 0);
    assert.equal(algorithm.rollCall(), null);
});

test('空格快捷键忽略长按、输入控件和弹窗，允许正常点名', () => {
    const listeners = [];
    let modalOpen = false;
    const context = vm.createContext({
        document: {
            readyState: 'loading',
            addEventListener(type, callback) {
                if (type === 'keydown') listeners.push(callback);
            },
            getElementById: () => null,
            querySelector: () => modalOpen ? {} : null
        }
    });
    vm.runInContext(readFileSync(join(__dirname, '..', 'js', 'app.js'), 'utf8'), context);
    const app = vm.runInContext('Object.create(RollCallApp.prototype)', context);
    const element = { addEventListener() {}, classList: { contains: () => false } };
    app.elements = new Proxy({ tabs: [] }, { get: (target, key) => target[key] || element });
    app.state = { activeTab: 'roll-call' };
    app.setupFormValidation = () => {};
    let calls = 0;
    app.handleRollCall = () => { calls++; };
    app.setupEventListeners();
    const event = {
        code: 'Space', repeat: false,
        target: { closest: () => null }, preventDefault() {}
    };
    listeners[0](event);
    assert.equal(calls, 1);
    listeners[0]({ ...event, repeat: true });
    listeners[0]({ ...event, ctrlKey: true });
    listeners[0]({ ...event, target: { closest: () => ({}) } });
    modalOpen = true;
    listeners[0](event);
    modalOpen = false;
    app.state.activeTab = 'students';
    listeners[0](event);
    assert.equal(calls, 1);
});

test('点名忙碌时不启动第二次动画', () => {
    const context = vm.createContext({ document: { readyState: 'loading', addEventListener() {} } });
    vm.runInContext(readFileSync(join(__dirname, '..', 'js', 'app.js'), 'utf8'), context);
    const app = vm.runInContext('Object.create(RollCallApp.prototype)', context);
    app.elements = { rollBtn: { disabled: true } };
    app.loadInitialData = () => assert.fail('忙碌时不应再次加载或启动点名');
    app.handleRollCall();
});
