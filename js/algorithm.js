/**
 * 公平随机点名算法
 */

class RollCallAlgorithm {
    constructor() {
        this.storage = storage;
    }

    /**
     * 在当前统计周期内找到被点名次数最少的学生集合
     */
    getLeastCalledGroup(students) {
        if (!students.length) {
            return [];
        }

        const minCalls = students.reduce((min, student) => Math.min(min, student.callCount || 0), Infinity);
        return students.filter(student => (student.callCount || 0) === minCalls);
    }

    /**
     * 从候选集合中随机选出一名学生
     */
    getRandomStudentFromGroup(group) {
        if (!group.length) {
            return null;
        }

        const randomIndex = Math.floor(Math.random() * group.length);
        return group[randomIndex];
    }

    /**
     * 执行公平随机点名
     * @returns {{id: string, name: string, seat: number}|null}
     */
    rollCall() {
        const students = this.storage.getStudents();
        if (!students.length) {
            return null;
        }

        const leastCalledGroup = this.getLeastCalledGroup(students);
        const selectedStudent = this.getRandomStudentFromGroup(leastCalledGroup);

        if (selectedStudent) {
            const data = this.storage.getAllData();
            const now = new Date();
            const updatedStudent = {
                ...selectedStudent,
                callCount: (selectedStudent.callCount || 0) + 1,
                lastCall: now.toISOString()
            };
            // 次数、历史和汇总一次提交，避免部分写入导致数据不一致。
            const saved = this.storage.saveAllData({
                ...data,
                students: students.map(student => student.id === selectedStudent.id ? updatedStudent : student),
                callHistory: [{
                    id: this.storage.generateUniqueId(),
                    studentId: updatedStudent.id,
                    studentName: updatedStudent.name,
                    studentSeat: updatedStudent.seat,
                    timestamp: now.toISOString(),
                    date: now.toLocaleDateString('zh-CN')
                }, ...data.callHistory].slice(0, 1000),
                stats: { ...data.stats, totalCalls: this.getTotalCalls() + 1 }
            });
            if (!saved) {
                throw new Error('点名记录保存失败，请检查浏览器存储空间后重试');
            }
            return updatedStudent;
        }

        return selectedStudent;
    }

    /**
     * 执行公平多人随机点名
     * @param {number} count 抽取人数
     * @returns {Array} 选中的学生数组
     */
    rollCallMultiple(count = 1) {
        const students = this.storage.getStudents();
        if (!students.length) {
            return [];
        }

        const pickCount = Math.min(Math.max(1, count), students.length);
        if (pickCount === 1) {
            const single = this.rollCall();
            return single ? [single] : [];
        }

        // 模拟多选轮次，严格保证每次从当前次数最少组抽选
        const tempCounts = new Map(students.map(s => [s.id, s.callCount || 0]));
        const selectedIds = [];

        for (let i = 0; i < pickCount; i++) {
            const available = students.filter(s => !selectedIds.includes(s.id));
            if (!available.length) break;

            const minCount = available.reduce((min, s) => Math.min(min, tempCounts.get(s.id)), Infinity);
            const candidates = available.filter(s => tempCounts.get(s.id) === minCount);
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];

            tempCounts.set(chosen.id, minCount + 1);
            selectedIds.push(chosen.id);
        }

        const now = new Date();
        const selectedMap = new Map();
        const updatedStudents = students.map(student => {
            if (selectedIds.includes(student.id)) {
                const updated = {
                    ...student,
                    callCount: (student.callCount || 0) + 1,
                    lastCall: now.toISOString()
                };
                selectedMap.set(student.id, updated);
                return updated;
            }
            return student;
        });

        const selectedList = selectedIds.map(id => selectedMap.get(id));
        const newHistoryEntries = selectedList.map(st => ({
            id: this.storage.generateUniqueId(),
            studentId: st.id,
            studentName: st.name,
            studentSeat: st.seat,
            timestamp: now.toISOString(),
            date: now.toLocaleDateString('zh-CN')
        }));

        const data = this.storage.getAllData();
        const saved = this.storage.saveAllData({
            ...data,
            students: updatedStudents,
            callHistory: [...newHistoryEntries, ...data.callHistory].slice(0, 1000),
            stats: { ...data.stats, totalCalls: this.getTotalCalls() + selectedList.length }
        });

        if (!saved) {
            throw new Error('点名记录保存失败，请检查浏览器存储空间后重试');
        }

        return selectedList;
    }

    /**
     * 更新学生被点名次数并写回存储
     */
    updateStudentCallCount(studentId) {
        const student = this.storage.getStudentById(studentId);
        if (!student) {
            return;
        }

        this.storage.updateStudent(studentId, {
            callCount: (student.callCount || 0) + 1,
            lastCall: new Date().toISOString()
        });
    }

    /**
     * 记录点名历史
     */
    recordCall(student) {
        this.storage.addCallRecord({
            studentId: student.id,
            studentName: student.name,
            studentSeat: student.seat
        });
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        const totalCalls = this.getTotalCalls();
        this.storage.updateStats({ totalCalls });
    }

    getTotalCalls() {
        // 兼容旧版本按最多 1000 条历史计算总次数的数据。
        return Math.max(
            this.storage.getStats().totalCalls || 0,
            this.storage.getCallHistory().length,
            this.storage.getStudents().reduce((sum, student) => sum + (student.callCount || 0), 0)
        );
    }

    /**
     * 预览下一次可能被点到的学生集合
     */
    previewNextCall() {
        const students = this.storage.getStudents();
        if (!students.length) {
            return null;
        }

        const leastCalledGroup = this.getLeastCalledGroup(students);
        return {
            possibleStudents: leastCalledGroup,
            minCallCount: leastCalledGroup[0]?.callCount || 0
        };
    }

    /**
     * 获取学生点名统计信息
     */
    getStudentStats() {
        const students = this.storage.getStudents();
        const totalStudents = students.length;
        const totalCalls = this.getTotalCalls();

        return {
            totalStudents,
            totalCalls,
            averageCalls: totalStudents ? totalCalls / totalStudents : 0,
            students: [...students].sort((a, b) => (b.callCount || 0) - (a.callCount || 0)),
            callDistribution: this.getCallDistribution(students)
        };
    }

    /**
     * 获取点名次数分布
     */
    getCallDistribution(students) {
        return students.reduce((distribution, student) => {
            const count = student.callCount || 0;
            distribution[count] = (distribution[count] || 0) + 1;
            return distribution;
        }, {});
    }

    /**
     * 重置所有学生的被点名次数和历史记录
     */
    resetAllCallCounts() {
        const students = this.storage.getStudents().map(student => ({
            ...student,
            callCount: 0,
            lastCall: null
        }));

        if (!this.storage.saveStudents(students, { resetHistory: true, resetStats: true })) {
            throw new Error('重置数据保存失败');
        }
    }
}

// 创建全局实例
const algorithm = new RollCallAlgorithm();

// 兼容性导出（用于测试）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = algorithm;
}
