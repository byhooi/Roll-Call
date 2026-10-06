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
    for (const file of ['storage.js', 'algorithm.js', 'excel.js']) {
        vm.runInContext(readFileSync(join(__dirname, '..', 'js', file), 'utf8'), context);
    }
    const { storage, algorithm, excel } = vm.runInContext('({ storage, algorithm, excel })', context);
    return { storage, algorithm, excel, values, writes, fail: () => { fail = true; } };
}

test('编辑学生信息：成功修改且同步更新索引，保留原有被点次数', () => {
    const { storage } = setup();
    storage.addStudent({ name: '张三', seat: 1 });
    const student = storage.getStudents()[0];
    storage.updateStudent(student.id, { callCount: 5 });

    // 编辑姓名和座位
    const success = storage.editStudent(student.id, { name: '张小三', seat: 10 });
    assert.equal(success, true);

    const updated = storage.getStudentById(student.id);
    assert.equal(updated.name, '张小三');
    assert.equal(updated.seat, 10);
    assert.equal(updated.callCount, 5);

    // 索引已同步更新
    assert.equal(storage.getStudentBySeat(10).id, student.id);
    assert.equal(storage.getStudentBySeat(1), null);
});

test('编辑学生信息：拒绝冲突的姓名和座位号，拒绝非法座位', () => {
    const { storage } = setup();
    storage.addStudent({ name: '张三', seat: 1 });
    storage.addStudent({ name: '李四', seat: 2 });
    const student2 = storage.getStudents()[1];

    // 不能改成已有学生张三的名字或座位1
    assert.throws(() => storage.editStudent(student2.id, { name: '张三', seat: 5 }), /已被其他学生占用/);
    assert.throws(() => storage.editStudent(student2.id, { name: '李四新', seat: 1 }), /已被其他学生占用/);

    // 非正整数座位号拦截
    assert.throws(() => storage.editStudent(student2.id, { name: '李四新', seat: 0 }), /正整数/);
    assert.throws(() => storage.editStudent(student2.id, { name: '李四新', seat: -3 }), /正整数/);
    assert.throws(() => storage.editStudent(student2.id, { name: '   ', seat: 5 }), /不能为空/);
});

test('多人公平点名：保证单次抽取不重复，且次数维持公平分布', () => {
    const { storage, algorithm } = setup();
    for (let i = 1; i <= 6; i++) {
        storage.addStudent({ name: `同学${i}`, seat: i });
    }

    // 一次抽取 3 人
    const picked = algorithm.rollCallMultiple(3);
    assert.equal(picked.length, 3);

    // 抽中的 3 人不重复
    const idSet = new Set(picked.map(p => p.id));
    assert.equal(idSet.size, 3);

    // 验证所有人的点名次数：抽中的为 1，未抽中的为 0
    const counts = storage.getStudents().map(s => s.callCount);
    assert.equal(counts.filter(c => c === 1).length, 3);
    assert.equal(counts.filter(c => c === 0).length, 3);

    // 点名历史和总点名次数增加了 3 条
    assert.equal(storage.getCallHistory().length, 3);
    assert.equal(algorithm.getStudentStats().totalCalls, 3);

    // 再抽 3 人，所有 6 个人的点名次数应当全部变为 1
    const secondPick = algorithm.rollCallMultiple(3);
    assert.equal(secondPick.length, 3);
    const countsAfter = storage.getStudents().map(s => s.callCount);
    assert.ok(countsAfter.every(c => c === 1));
});

test('示例学生名单生成器提供合法的学生数据集', () => {
    const { excel, storage } = setup();
    const samples = excel.getSampleStudents();
    assert.ok(Array.isArray(samples));
    assert.ok(samples.length >= 20);

    // 可以无异常完整存入 storage 并重建索引
    const saved = storage.saveStudents(samples);
    assert.equal(saved, true);
    assert.equal(storage.getStudents().length, samples.length);
    assert.ok(storage.getStudentBySeat(1) !== null);
});
