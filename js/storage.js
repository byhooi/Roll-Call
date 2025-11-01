/**
 * LocalStorage 数据管理模块
 */

class StorageManager {
    constructor() {
        this.storageKey = 'roll-call-data';
        this.backupKey = 'roll-call-backup';

        // 运行时状态
        this.idCounter = 0;
        this.studentIndex = new Map();
        this.seatIndex = new Map();
        this.autoBackupInterval = null;
        this.backupEnabled = false;
        this.dataCache = null;
        this.lastBackupSignature = null;
    }

    /**
     * 创建默认数据结构
     */
    createDefaultData() {
        return {
            students: [],
            callHistory: [],
            stats: {
                cycleStart: new Date().toISOString().split('T')[0],
                totalCalls: 0
            }
        };
    }

    /**
     * 启用自动备份
     */
    enableAutoBackup(intervalMinutes = 5) {
        this.disableAutoBackup();

        this.backupEnabled = true;
        this.lastBackupSignature = null;
        this.autoBackupInterval = setInterval(() => {
            if (this.backupEnabled && this.hasData()) {
                this.createAutoBackup();
            }
        }, intervalMinutes * 60 * 1000);

        if (this.hasData()) {
            this.createAutoBackup();
        }

        console.log(`自动备份已启用，间隔 ${intervalMinutes} 分钟`);
    }

    /**
     * 禁用自动备份
     */
    disableAutoBackup() {
        const wasActive = this.autoBackupInterval !== null || this.backupEnabled;

        if (this.autoBackupInterval) {
            clearInterval(this.autoBackupInterval);
            this.autoBackupInterval = null;
        }
        this.backupEnabled = false;
        this.lastBackupSignature = null;

        if (wasActive) {
            console.log('自动备份已禁用');
        }
    }

    /**
     * 判断是否触发了存储配额限制
     */
    isQuotaExceeded(error) {
        if (!error) return false;
        return error.name === 'QuotaExceededError'
            || error.code === 22
            || error.code === 1014
            || /quota/i.test(error.message || '');
    }

    /**
     * 创建自动备份
     */
    createAutoBackup() {
        if (!this.backupEnabled) {
            return;
        }

        try {
            const data = this.getAllData();
            if (!data.students.length && !data.callHistory.length) {
                return;
            }
            const backupData = {
                data,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };

            const payload = JSON.stringify(backupData);
            if (payload === this.lastBackupSignature) {
                return;
            }

            localStorage.setItem(this.backupKey, payload);
            this.lastBackupSignature = payload;
            console.log('自动备份创建成功');
        } catch (error) {
            if (this.isQuotaExceeded(error)) {
                console.warn('自动备份失败：存储空间不足，自动备份已暂停');
                this.disableAutoBackup();
            } else {
                console.error('自动备份失败:', error);
            }
        }
    }

    /**
     * 获取自动备份
     */
    getAutoBackup() {
        try {
            const backupData = localStorage.getItem(this.backupKey);
            return backupData ? JSON.parse(backupData) : null;
        } catch (error) {
            console.error('获取备份失败:', error);
            return null;
        }
    }

    /**
     * 恢复自动备份
     */
    restoreAutoBackup() {
        try {
            const backupData = this.getAutoBackup();
            if (!backupData || !backupData.data) {
                throw new Error('没有找到有效的备份数据');
            }

            const result = this.saveAllData(backupData.data);
            if (result) {
                this.updateIndexes(this.getStudents());
                console.log('已从备份恢复数据');
                return {
                    success: true,
                    message: `成功恢复 ${backupData.timestamp} 的备份`,
                    timestamp: backupData.timestamp
                };
            }

            throw new Error('保存备份数据失败');
        } catch (error) {
            console.error('恢复备份失败:', error);
            return {
                success: false,
                message: '恢复备份失败: ' + error.message
            };
        }
    }

    /**
     * 清除所有备份
     */
    clearAllBackups() {
        try {
            localStorage.removeItem(this.backupKey);
            this.lastBackupSignature = null;
            console.log('所有备份已清除');
            return true;
        } catch (error) {
            console.error('清除备份失败:', error);
            return false;
        }
    }

    hasBackup() {
        const backupData = this.getAutoBackup();
        return !!(backupData && backupData.data);
    }

    /**
     * 生成唯一 ID
     */
    generateUniqueId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 11);
        const counter = (++this.idCounter).toString(36);
        return `${timestamp}${random}${counter}`;
    }

    /**
     * 获取全部数据
     */
    getAllData(forceReload = false) {
        if (!this.dataCache || forceReload) {
            try {
                const raw = localStorage.getItem(this.storageKey);
                if (!raw) {
                    this.dataCache = this.createDefaultData();
                } else {
                    const parsed = JSON.parse(raw);
                    const defaults = this.createDefaultData();
                    this.dataCache = {
                        ...defaults,
                        ...parsed,
                        students: Array.isArray(parsed.students) ? parsed.students : [],
                        callHistory: Array.isArray(parsed.callHistory) ? parsed.callHistory : [],
                        stats: {
                            ...defaults.stats,
                            ...(parsed.stats || {})
                        }
                    };
                }
            } catch (error) {
                console.error('获取数据失败:', error);
                this.dataCache = this.createDefaultData();
            }
        }
        return this.dataCache;
    }

    reloadCache() {
        this.dataCache = null;
        return this.getAllData(true);
    }

    /**
     * 保存全部数据
     */
    saveAllData(data) {
        const payload = JSON.stringify(data);

        try {
            localStorage.setItem(this.storageKey, payload);
            this.dataCache = data;
            this.lastBackupSignature = null;
            return true;
        } catch (error) {
            if (this.isQuotaExceeded(error)) {
                console.warn('保存数据失败：存储空间不足，尝试清理备份后重试');
                const backupsCleared = this.clearAllBackups();
                this.disableAutoBackup();

                if (backupsCleared) {
                    try {
                        localStorage.setItem(this.storageKey, payload);
                        this.dataCache = data;
                        this.lastBackupSignature = null;
                        return true;
                    } catch (retryError) {
                        console.error('清理备份后仍无法保存数据:', retryError);
                    }
                }
            } else {
                console.error('保存数据失败:', error);
            }

            this.reloadCache();
            return false;
        }
    }

    /**
     * 获取学生列表
     */
    getStudents() {
        const data = this.getAllData();
        return data.students;
    }

    /**
     * 保存学生列表
     */
    saveStudents(students, options = {}) {
        const { resetHistory = false, resetStats = false } = options;
        const data = this.getAllData();
        data.students = students;

        if (resetHistory) {
            data.callHistory = [];
        }

        if (resetStats) {
            data.stats = {
                cycleStart: new Date().toISOString().split('T')[0],
                totalCalls: 0
            };
        }

        this.updateIndexes(students);
        return this.saveAllData(data);
    }

    /**
     * 添加学生
     */
    addStudent(student) {
        const data = this.getAllData();
        const newStudent = {
            id: this.generateUniqueId(),
            name: student.name,
            seat: student.seat,
            callCount: 0,
            lastCall: null
        };
        data.students.push(newStudent);
        this.updateIndexes(data.students);
        return this.saveAllData(data);
    }

    /**
     * 更新学生信息
     */
    updateStudent(studentId, updates) {
        const data = this.getAllData();
        const index = data.students.findIndex(student => student.id === studentId);
        if (index === -1) {
            return false;
        }

        data.students[index] = { ...data.students[index], ...updates };
        this.updateIndexes(data.students);
        return this.saveAllData(data);
    }

    /**
     * 删除学生
     */
    deleteStudent(studentId) {
        const data = this.getAllData();
        data.students = data.students.filter(student => student.id !== studentId);
        this.updateIndexes(data.students);
        return this.saveAllData(data);
    }

    /**
     * 清空学生列表
     */
    clearStudents() {
        const data = this.getAllData();
        data.students = [];
        this.updateIndexes(data.students);
        return this.saveAllData(data);
    }

    /**
     * 获取点名历史
     */
    getCallHistory() {
        return this.getAllData().callHistory;
    }

    /**
     * 添加点名记录
     */
    addCallRecord(record) {
        const data = this.getAllData();
        const newRecord = {
            id: this.generateUniqueId(),
            studentId: record.studentId,
            studentName: record.studentName,
            studentSeat: record.studentSeat,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('zh-CN')
        };

        data.callHistory.unshift(newRecord);
        if (data.callHistory.length > 1000) {
            data.callHistory.length = 1000;
        }

        return this.saveAllData(data);
    }

    /**
     * 清空点名历史
     */
    clearCallHistory() {
        const data = this.getAllData();
        data.callHistory = [];
        return this.saveAllData(data);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const data = this.getAllData();
        return data.stats;
    }

    /**
     * 更新统计信息
     */
    updateStats(updates) {
        const data = this.getAllData();
        data.stats = { ...data.stats, ...updates };
        return this.saveAllData(data);
    }

    /**
     * 重置统计周期
     */
    resetStatsCycle() {
        const data = this.getAllData();
        data.stats = {
            cycleStart: new Date().toISOString().split('T')[0],
            totalCalls: 0
        };
        return this.saveAllData(data);
    }

    /**
     * 更新内存索引，加速查找
     */
    updateIndexes(students) {
        this.studentIndex.clear();
        this.seatIndex.clear();

        students.forEach(student => {
            this.studentIndex.set(student.id, student);
            this.seatIndex.set(student.seat, student);
        });
    }

    /**
     * 快速获取学生信息
     */
    getStudentById(id) {
        return this.studentIndex.get(id) || null;
    }

    getStudentBySeat(seat) {
        return this.seatIndex.get(seat) || null;
    }

    /**
     * 导出与导入
     */
    exportData() {
        const data = this.getAllData();
        return JSON.stringify(data, null, 2);
    }

    importData(jsonData) {
        try {
            const parsed = JSON.parse(jsonData);
            if (parsed.students && parsed.callHistory && parsed.stats) {
                const result = this.saveAllData(parsed);
                if (result) {
                    this.updateIndexes(parsed.students);
                }
                return result;
            }
            return false;
        } catch (error) {
            console.error('导入数据失败:', error);
            return false;
        }
    }

    /**
     * 清空全部数据
     */
    clearAllData() {
        const emptyData = this.createDefaultData();
        this.updateIndexes(emptyData.students);
        const result = this.saveAllData(emptyData);
        if (result) {
            this.clearAllBackups();
        }
        return result;
    }

    /**
     * 是否存在任何数据
     */
    hasData() {
        const data = this.getAllData();
        return data.students.length > 0 || data.callHistory.length > 0;
    }

    /**
     * 初始化索引
     */
    initializeIndexes() {
        this.updateIndexes(this.getStudents());
    }

    /**
     * 获取备份信息摘要
     */
    getBackupInfo() {
        const backup = this.getAutoBackup();
        if (!backup) {
            return {
                hasBackup: false,
                message: '没有找到备份'
            };
        }

        const backupDate = new Date(backup.timestamp);
        const hoursAgo = Math.floor((Date.now() - backupDate.getTime()) / (1000 * 60 * 60));

        return {
            hasBackup: true,
            timestamp: backup.timestamp,
            hoursAgo,
            message: `最后备份：${backupDate.toLocaleString('zh-CN')}（约 ${hoursAgo} 小时前）`
        };
    }
}

const storage = new StorageManager();
storage.initializeIndexes();
storage.enableAutoBackup();
