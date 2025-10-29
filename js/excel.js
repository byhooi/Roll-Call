/**
 * Excel 导入导出功能
 */

// 创建 ExcelManager 类
class ExcelManager {
    constructor() {
        this.storage = storage;
    }

    /**
     * 导入 Excel 文件中的学生名单
     * @param {File} file Excel 文件
     * @returns {Promise} 导入结果
     */
    async importStudentsFromExcel(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);

                        // 使用更好的编码选项来处理中文字符
                        const workbook = XLSX.read(data, {
                            type: 'array',
                            codepage: 65001, // UTF-8编码
                            cellNF: false,
                            cellHTML: false,
                            cellFormula: false
                        });

                        // 假设第一个工作表包含学生数据
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];

                        // 转换为 JSON，使用原始值避免编码问题
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                            header: 1,
                            raw: true, // 使用原始值，避免类型转换
                            defval: '' // 默认值为空字符串
                        });

                        if (jsonData.length < 2) {
                            reject(new Error('Excel 文件中没有找到学生数据'));
                            return;
                        }

                        // 解析学生数据（第一行为表头，从第二行开始为数据）
                        const students = [];
                        const headers = jsonData[0];

                        // 验证表头（使用trim()去除可能的空格和不可见字符）
                        const nameIndex = headers.findIndex(h =>
                            h && h.toString().trim().toLowerCase().includes('姓名')
                        );
                        const seatIndex = headers.findIndex(h =>
                            h && h.toString().trim().toLowerCase().includes('座位')
                        );

                        if (nameIndex === -1 || seatIndex === -1) {
                            reject(new Error('Excel 文件缺少必要的表头：姓名、座位号'));
                            return;
                        }

                        // 显示导入进度
                        let processedCount = 0;
                        const totalCount = jsonData.length - 1;

                        for (let i = 1; i < jsonData.length; i++) {
                            const row = jsonData[i];
                            const name = row[nameIndex];
                            const seat = row[seatIndex];

                            if (name && seat !== undefined) {
                                // 确保姓名是字符串并去除首尾空格
                                const studentName = name ? name.toString().trim() : '';
                                const studentSeat = parseInt(seat) || 0;

                                if (studentName && studentSeat > 0) {
                                    students.push({
                                        id: this.storage.generateUniqueId(),
                                        name: studentName,
                                        seat: studentSeat,
                                        callCount: 0,
                                        lastCall: null
                                    });
                                }
                            }

                            processedCount++;

                            // 更新进度（每处理10条记录更新一次）
                            if (processedCount % 10 === 0 || processedCount === totalCount) {
                                const progress = Math.round((processedCount / totalCount) * 100);
                                console.log(`导入进度: ${progress}% (${processedCount}/${totalCount})`);
                            }
                        }

                        if (students.length === 0) {
                            reject(new Error('没有找到有效的学生数据'));
                            return;
                        }

                        // 保存学生数据
                        if (this.storage.saveStudents(students)) {
                            resolve({
                                success: true,
                                count: students.length,
                                message: `成功导入 ${students.length} 名学生`,
                                newStudents: students
                            });
                        } else {
                            reject(new Error('保存学生数据失败'));
                        }

                    } catch (error) {
                        reject(new Error('解析 Excel 文件失败: ' + error.message));
                    }
                };

                reader.readAsArrayBuffer(file);

            } catch (error) {
                reject(new Error('读取文件失败: ' + error.message));
            }
        });
    }

    /**
     * 导出学生名单为 Excel 文件
     * @returns {Promise} 导出结果
     */
    async exportStudentsToExcel() {
        return new Promise((resolve, reject) => {
            try {
                const students = this.storage.getStudents();

                if (students.length === 0) {
                    reject(new Error('没有学生数据可以导出'));
                    return;
                }

                // 准备导出数据
                const exportData = students.map(student => ({
                    '座位号': student.seat,
                    '姓名': student.name,
                    '被点次数': student.callCount,
                    '最后点名时间': student.lastCall ?
                        new Date(student.lastCall).toLocaleString('zh-CN') : '从未被点'
                }));

                // 创建工作表
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, '学生名单');

                // 生成文件名
                const dateStr = new Date().toISOString().split('T')[0];
                const fileName = `班级学生名单_${dateStr}.xlsx`;

                // 写入文件
                XLSX.writeFile(workbook, fileName);

                resolve({
                    success: true,
                    message: `成功导出 ${students.length} 名学生`
                });

            } catch (error) {
                reject(new Error('导出 Excel 文件失败: ' + error.message));
            }
        });
    }

    /**
     * 导出统计报表为 Excel 文件
     * @returns {Promise} 导出结果
     */
    async exportStatisticsToExcel() {
        return new Promise((resolve, reject) => {
            try {
                const stats = algorithm.getStudentStats();

                if (stats.totalStudents === 0) {
                    reject(new Error('没有统计数据可以导出'));
                    return;
                }

                // 准备导出数据
                const exportData = stats.students.map((student, index) => ({
                    '座位号': student.seat,
                    '姓名': student.name,
                    '被点次数': student.callCount,
                    '最后点名时间': student.lastCall ?
                        new Date(student.lastCall).toLocaleString('zh-CN') : '从未被点'
                }));

                // 添加汇总信息
                const summaryData = [
                    { '项目': '统计周期开始日期', '数值': this.storage.getStats().cycleStart },
                    { '项目': '学生总数', '数值': stats.totalStudents },
                    { '项目': '总点名次数', '数值': stats.totalCalls },
                    { '项目': '平均被点次数', '数值': stats.averageCalls.toFixed(1) },
                    { '项目': '点名分布', '数值': this.formatCallDistribution(stats.callDistribution) }
                ];

                // 创建工作表
                const workbook = XLSX.utils.book_new();

                // 点名详情表
                const detailSheet = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(workbook, detailSheet, '点名详情');

                // 汇总信息表
                const summarySheet = XLSX.utils.json_to_sheet(summaryData);
                XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总信息');

                // 生成文件名
                const dateStr = new Date().toISOString().split('T')[0];
                const fileName = `班级统计报表_${dateStr}.xlsx`;

                // 写入文件
                XLSX.writeFile(workbook, fileName);

                resolve({
                    success: true,
                    message: '成功导出统计报表'
                });

            } catch (error) {
                reject(new Error('导出 Excel 文件失败: ' + error.message));
            }
        });
    }

    /**
     * 导出完整数据备份为 JSON 文件
     */
    exportDataBackup() {
        try {
            const data = this.storage.exportData();
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `班级数据备份_${dateStr}.json`;

            // 创建并下载文件
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);

            return {
                success: true,
                message: '数据备份导出成功'
            };
        } catch (error) {
            throw new Error('导出数据备份失败: ' + error.message);
        }
    }

    /**
     * 导入数据备份
     * @param {File} file JSON 文件
     * @returns {Promise} 导入结果
     */
    async importDataBackup(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const result = this.storage.importData(e.target.result);

                        if (result) {
                            resolve({
                                success: true,
                                message: '数据导入成功'
                            });
                        } else {
                            reject(new Error('数据格式不正确'));
                        }

                    } catch (error) {
                        reject(new Error('导入数据失败: ' + error.message));
                    }
                };

                reader.readAsText(file);

            } catch (error) {
                reject(new Error('读取文件失败: ' + error.message));
            }
        });
    }

    /**
     * 验证学生数据质量
     * @param {Array} students 学生数据数组
     * @returns {Object} 验证结果
     */
    validateStudentData(students) {
        const issues = [];
        const seatSet = new Set();
        const nameSet = new Set();

        students.forEach((student, index) => {
            const rowNumber = index + 2; // +2 because header is row 1 and array is 0-based

            // 检查座位号重复
            if (seatSet.has(student.seat)) {
                issues.push({
                    type: 'duplicate_seat',
                    message: `第 ${rowNumber} 行：座位号 ${student.seat} 与之前的学生重复`,
                    row: rowNumber,
                    student: student.name
                });
            } else {
                seatSet.add(student.seat);
            }

            // 检查姓名重复
            if (nameSet.has(student.name)) {
                issues.push({
                    type: 'duplicate_name',
                    message: `第 ${rowNumber} 行：学生姓名 "${student.name}" 与之前的学生重复`,
                    row: rowNumber,
                    student: student.name
                });
            } else {
                nameSet.add(student.name);
            }

            // 检查姓名长度
            if (student.name.length > 20) {
                issues.push({
                    type: 'name_too_long',
                    message: `第 ${rowNumber} 行：学生姓名 "${student.name}" 过长（超过20个字符）`,
                    row: rowNumber,
                    student: student.name
                });
            }

            // 检查座位号合理性
            if (student.seat > 100) {
                issues.push({
                    type: 'seat_too_high',
                    message: `第 ${rowNumber} 行：座位号 ${student.seat} 过高（建议不超过100）`,
                    row: rowNumber,
                    student: student.name
                });
            }
        });

        return {
            isValid: issues.length === 0,
            issues: issues,
            warnings: issues.filter(issue => issue.type !== 'duplicate_seat' && issue.type !== 'duplicate_name'),
            errors: issues.filter(issue => issue.type === 'duplicate_seat' || issue.type === 'duplicate_name')
        };
    }

    /**
     * 获取学生的被点名次数（辅助方法）
     */
    getStudentCallCount(studentId) {
        const students = this.storage.getStudents();
        const student = students.find(s => s.id === studentId);
        return student ? student.callCount : 0;
    }

    /**
     * 格式化点名分布信息
     */
    formatCallDistribution(distribution) {
        const entries = Object.entries(distribution)
            .map(([count, numStudents]) => `${count}次: ${numStudents}人`)
            .join(', ');
        return entries || '无数据';
    }
}

// 创建全局实例
const excel = new ExcelManager();

// 兼容性导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = excel;
}