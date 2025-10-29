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

        const minCalls = Math.min(...students.map(student => student.callCount || 0));
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
            this.updateStudentCallCount(selectedStudent.id);
            this.recordCall(selectedStudent);
            this.updateStats();
        }

        return selectedStudent;
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
        const totalCalls = this.storage.getCallHistory().length;
        this.storage.updateStats({ totalCalls });
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
        const callHistory = this.storage.getCallHistory();
        const totalStudents = students.length;
        const totalCalls = callHistory.length;

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

        this.storage.saveStudents(students);
        this.storage.resetStatsCycle();
        this.storage.clearCallHistory();
    }
}

// 创建全局实例
const algorithm = new RollCallAlgorithm();

// 兼容性导出（用于测试）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = algorithm;
}
