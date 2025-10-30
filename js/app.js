/**
 * 简单的通知系统
 */
class NotificationSystem {
    static show(message, type = 'info') {
        // 创建toast通知
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 触发显示动画
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // 3秒后自动移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    static success(message) {
        this.show(message, 'success');
    }

    static error(message) {
        this.show(message, 'error');
    }

    static info(message) {
        this.show(message, 'info');
    }
}

// 创建 RollCallApp 类
class RollCallApp {
    constructor() {
        this.storage = storage;
        this.algorithm = algorithm;
        this.excel = excel;

        // 缓存 DOM 元素
        this.elements = {};

        // 当前状态
        this.state = {
            activeTab: 'roll-call',
            students: [],
            callHistory: [],
            stats: {},
            selectedStudent: null
        };

        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.loadInitialData();
        this.updateUI();

        // 检查是否有备份可以恢复
        // this.checkForBackupRestore();
    }

    /**
     * 缓存 DOM 元素
     */
    cacheElements() {
        // 主要容器
        this.elements.container = document.querySelector('.container');
        this.elements.tabs = document.querySelectorAll('.tab-btn');
        this.elements.tabContents = document.querySelectorAll('.tab-content');

        // 点名页面
        this.elements.rollBtn = document.getElementById('roll-btn');
        this.elements.selectedStudent = document.getElementById('selected-student');
        this.elements.studentInfo = document.getElementById('student-info');

        // 学生管理页面
        this.elements.importExcel = document.getElementById('import-excel');
        this.elements.addStudentBtn = document.getElementById('add-student-btn');
        this.elements.clearDataBtn = document.getElementById('clear-data-btn');
        this.elements.studentCount = document.getElementById('student-count');
        this.elements.studentsTbody = document.getElementById('students-tbody');

        // 统计分析页面
        this.elements.resetStatsBtn = document.getElementById('reset-stats-btn');
        this.elements.exportStatsBtn = document.getElementById('export-stats-btn');
        this.elements.totalCalls = document.getElementById('total-calls');
        this.elements.totalStudents = document.getElementById('total-students');
        this.elements.avgCalls = document.getElementById('avg-calls');
        this.elements.statsGrid = document.getElementById('stats-grid');

        // 弹窗
        this.elements.addStudentModal = document.getElementById('add-student-modal');
        this.elements.addStudentForm = document.getElementById('add-student-form');
        this.elements.cancelAddBtn = document.getElementById('cancel-add-btn');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 标签页切换
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 点名按钮
        this.elements.rollBtn.addEventListener('click', (e) => {
            this.handleRollCall();
            // 移除按钮焦点,防止按钮在点击后保持焦点状态导致样式异常
            const btn = e.target;
            btn.blur();
            // 强制重置按钮状态
            setTimeout(() => {
                btn.style.opacity = '1';
                btn.blur();
            }, 100);
        });

        // 快捷键支持：空格键开始点名
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.state.activeTab === 'roll-call' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.handleRollCall();
            }
        });

        // 学生管理
        this.elements.importExcelBtn = document.getElementById('import-excel-btn');
        this.elements.importExcel.addEventListener('change', (e) => {
            this.handleImportExcel(e.target.files[0]);
        });

        this.elements.importExcelBtn.addEventListener('click', () => {
            this.elements.importExcel.click();
        });

        this.elements.addStudentBtn.addEventListener('click', () => {
            this.showAddStudentModal();
        });

        this.elements.clearDataBtn.addEventListener('click', () => {
            this.handleClearData();
        });

        // 统计分析
        this.elements.resetStatsBtn.addEventListener('click', () => {
            this.handleResetStats();
        });

        this.elements.exportStatsBtn.addEventListener('click', () => {
            this.handleExportStats();
        });

        // 弹窗
        this.elements.addStudentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddStudent();
        });

        this.elements.cancelAddBtn.addEventListener('click', () => {
            this.hideAddStudentModal();
        });

        // 键盘快捷键：ESC关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.elements.addStudentModal.classList.contains('active')) {
                this.hideAddStudentModal();
            }
        });

        // 点击弹窗外部关闭
        this.elements.addStudentModal.addEventListener('click', (e) => {
            if (e.target === this.elements.addStudentModal) {
                this.hideAddStudentModal();
            }
        });

        // 表单验证和实时反馈
        this.setupFormValidation();
    }

    /**
     * 设置表单验证和实时反馈
     */
    setupFormValidation() {
        const nameInput = document.getElementById('student-name');
        const seatInput = document.getElementById('student-seat');

        // 姓名输入验证
        nameInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value.length > 0 && value.length < 2) {
                e.target.style.borderColor = '#ffc107';
                e.target.title = '姓名至少需要2个字符';
            } else if (value.length >= 2) {
                e.target.style.borderColor = '#28a745';
                e.target.title = '';
            } else {
                e.target.style.borderColor = '';
                e.target.title = '';
            }
        });

        // 座位号输入验证
        seatInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value && value > 0) {
                e.target.style.borderColor = '#28a745';
                e.target.title = '';
            } else if (value === 0) {
                e.target.style.borderColor = '#ffc107';
                e.target.title = '座位号必须大于0';
            } else {
                e.target.style.borderColor = '';
                e.target.title = '';
            }
        });

        // 失去焦点时的验证
        nameInput.addEventListener('blur', (e) => {
            const value = e.target.value.trim();
            if (value.length > 0 && value.length < 2) {
                NotificationSystem.info('姓名至少需要2个字符');
            }
        });

        seatInput.addEventListener('blur', (e) => {
            const value = parseInt(e.target.value);
            if (value <= 0) {
                NotificationSystem.info('座位号必须大于0');
            }
        });
    }

    /**
     * 加载初始数据
     */
    loadInitialData() {
        this.state.students = this.storage.getStudents();
        this.state.callHistory = this.storage.getCallHistory();
        this.state.stats = this.storage.getStats();
    }

    /**
     * 切换标签页
     */
    switchTab(tabName) {
        // 更新状态
        this.state.activeTab = tabName;

        // 更新标签页按钮
        this.elements.tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // 更新内容显示
        this.elements.tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabName) {
                content.classList.add('active');
            }
        });

        // 刷新当前页面数据
        this.updateCurrentTab();
    }

    /**
     * 更新当前标签页
     */
    updateCurrentTab() {
        switch (this.state.activeTab) {
            case 'students':
                this.updateStudentsTab();
                break;
            case 'statistics':
                this.updateStatisticsTab();
                break;
        }
    }

    /**
     * 处理点名
     */
    handleRollCall() {
        if (this.state.students.length === 0) {
            NotificationSystem.error('请先导入学生名单');
            return;
        }

        // 禁用按钮防止重复点击
        this.elements.rollBtn.disabled = true;
        this.elements.rollBtn.style.opacity = '0.6';
        this.elements.rollBtn.style.cursor = 'not-allowed';

        // 开始滚动动画
        this.startRollingAnimation(() => {
            // 执行点名
            this.state.selectedStudent = this.algorithm.rollCall();

            if (this.state.selectedStudent) {
                this.showSelectedStudent();
                this.updateUI();
            }

            // 恢复按钮
            setTimeout(() => {
                this.elements.rollBtn.disabled = false;
                this.elements.rollBtn.style.opacity = '1';
                this.elements.rollBtn.style.cursor = 'pointer';
            }, 2000);
        });
    }

    /**
     * 开始滚动动画 - 随机显示学生名字
     */
    startRollingAnimation(callback) {
        const duration = 2000; // 滚动持续2秒
        const interval = 80; // 每80毫秒切换一次
        const iterations = Math.floor(duration / interval);
        let count = 0;

        // 添加滚动中的样式
        this.elements.selectedStudent.classList.add('rolling-fast');

        const rollInterval = setInterval(() => {
            // 随机选择一个学生显示
            const randomStudent = this.state.students[Math.floor(Math.random() * this.state.students.length)];

            this.elements.selectedStudent.innerHTML = `
                <div class="name rolling-text">${randomStudent.name}</div>
                <div class="seat rolling-text">座位号：${randomStudent.seat}</div>
            `;

            count++;

            // 逐渐减慢速度
            if (count >= iterations - 5) {
                clearInterval(rollInterval);
                setTimeout(() => {
                    this.elements.selectedStudent.classList.remove('rolling-fast');
                    callback();
                }, 200);
            }
        }, interval);
    }

    /**
     * 显示被选中的学生（带酷炫动画）
     */
    showSelectedStudent() {
        if (!this.state.selectedStudent) return;

        const student = this.state.selectedStudent;

        // 创建粒子爆炸效果
        this.createParticleExplosion();

        // 添加3D翻转动画
        this.elements.selectedStudent.classList.add('flip-in');

        this.elements.selectedStudent.innerHTML = `
            <div class="name glow-text">${student.name}</div>
            <div class="seat glow-text">座位号：${student.seat}</div>
        `;

        this.elements.studentInfo.innerHTML = `
            该学生本周期内已被点中 <strong>${student.callCount}</strong> 次
        `;

        // 移除动画类
        setTimeout(() => {
            this.elements.selectedStudent.classList.remove('flip-in');
        }, 1000);
    }

    /**
     * 创建粒子爆炸效果
     */
    createParticleExplosion() {
        const resultDisplay = document.querySelector('.result-display');
        const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b'];

        // 创建30个粒子
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];

            // 随机方向和距离
            const angle = (Math.PI * 2 * i) / 30;
            const velocity = 100 + Math.random() * 100;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);

            resultDisplay.appendChild(particle);

            // 动画结束后移除
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
    }

    /**
     * 导入 Excel 文件
     */
    async handleImportExcel(file) {
        if (!file) return;

        try {
            const previousStudents = this.storage.getStudents().map(student => ({ ...student }));
            this.showLoading('正在导入学生名单...');
            const result = await this.excel.importStudentsFromExcel(file);

            // 验证数据质量
            const validation = this.excel.validateStudentData(result.newStudents);

            // 显示验证结果
            if (!validation.isValid) {
                let message = `发现 ${validation.errors.length} 个错误，${validation.warnings.length} 个警告：\n\n`;
                validation.issues.forEach(issue => {
                    message += issue.message + '\n';
                });
                message += '\n是否继续导入？';

                if (!confirm(message)) {
                    // 恢复导入前的数据快照
                    this.storage.saveStudents(previousStudents);
                    this.elements.importExcel.value = '';
                    this.loadInitialData();
                    this.updateUI();
                    this.updateCurrentTab();
                    NotificationSystem.info('导入已取消，已恢复原有学生名单');
                    return;
                }
            }

            // 重置文件输入
            this.elements.importExcel.value = '';

            NotificationSystem.success(result.message);
            this.loadInitialData();
            this.updateUI();
            this.updateCurrentTab();

        } catch (error) {
            NotificationSystem.error('导入失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 显示添加学生弹窗
     */
    showAddStudentModal() {
        this.elements.addStudentModal.classList.add('active');
        this.elements.addStudentForm.reset();
    }

    /**
     * 隐藏添加学生弹窗
     */
    hideAddStudentModal() {
        this.elements.addStudentModal.classList.remove('active');
    }

    /**
     * 添加学生
     */
    async handleAddStudent() {
        const name = document.getElementById('student-name').value.trim();
        const seat = parseInt(document.getElementById('student-seat').value);

        if (!name || !seat || seat <= 0) {
            NotificationSystem.error('请填写完整的学生信息');
            return;
        }

        try {
            const result = this.storage.addStudent({ name, seat });

            if (result) {
                NotificationSystem.success('学生添加成功');
                this.hideAddStudentModal();
                this.loadInitialData();
                this.updateUI();
                this.updateCurrentTab();
            } else {
                NotificationSystem.error('添加学生失败');
            }
        } catch (error) {
            NotificationSystem.error('添加学生失败: ' + error.message);
        }
    }

    /**
     * 更新学生管理页面
     */
    updateStudentsTab() {
        this.updateStudentList();
    }

    /**
     * 更新学生列表显示
     */
    updateStudentList() {
        this.elements.studentCount.textContent = this.state.students.length;

        if (this.state.students.length === 0) {
            this.elements.studentsTbody.innerHTML = `
                <tr><td colspan="3" class="empty-message">暂无学生数据，请导入学生名单</td></tr>
            `;
            return;
        }

        const tbodyHTML = this.state.students.map(student => `
            <tr>
                <td>${student.seat}</td>
                <td>${student.name}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteStudent('${student.id}')">删除</button>
                </td>
            </tr>
        `).join('');

        this.elements.studentsTbody.innerHTML = tbodyHTML;
    }

    /**
     * 删除学生
     */
    deleteStudent(studentId) {
        // 获取学生信息用于显示确认对话框
        const student = this.storage.getStudentById(studentId);
        if (!student) {
            NotificationSystem.error('学生不存在');
            return;
        }

        const confirmMessage = `
            <div style="text-align: left;">
                <strong>确认删除学生？</strong><br>
                姓名：${student.name}<br>
                座位号：${student.seat}<br>
                被点次数：${student.callCount}<br>
                <span style="color: #666; font-size: 0.9em;">此操作不可恢复</span>
            </div>
        `;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const result = this.storage.deleteStudent(studentId);

            if (result) {
                NotificationSystem.success(`学生 ${student.name} 已删除`);
                this.loadInitialData();
                this.updateUI();
                this.updateCurrentTab();
            } else {
                NotificationSystem.error('删除学生失败');
            }
        } catch (error) {
            NotificationSystem.error('删除学生失败: ' + error.message);
        }
    }

    /**
     * 更新统计分析页面
     */
    updateStatisticsTab() {
        this.updateStatistics();
    }

    /**
     * 更新统计信息
     */
    updateStatistics() {
        const stats = this.algorithm.getStudentStats();

        this.elements.totalCalls.textContent = stats.totalCalls;
        this.elements.totalStudents.textContent = stats.totalStudents;
        this.elements.avgCalls.textContent = stats.averageCalls.toFixed(1);

        if (stats.totalStudents === 0) {
            this.elements.statsGrid.innerHTML = `
                <div class="empty-message">暂无统计数据</div>
            `;
            return;
        }

        const statsHTML = stats.students.map((student, index) => `
            <div class="stat-item-card">
                <div class="stat-item-header">
                    <div class="stat-seat">座位号：${student.seat}</div>
                    <span class="stat-call-count">${student.callCount} 次</span>
                </div>
                <div class="stat-item-body">
                    <div class="stat-name">${student.name}</div>
                </div>
                <div class="stat-item-footer">
                    <div class="stat-last-call">
                        最后点名：${student.lastCall ?
                            new Date(student.lastCall).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            }) : '从未被点'}
                    </div>
                </div>
            </div>
        `).join('');

        this.elements.statsGrid.innerHTML = statsHTML;
    }

    /**
     * 重置统计周期
     */
    handleResetStats() {
        if (!confirm('确定要重置统计周期吗？这将清零所有学生的被点名次数！')) {
            return;
        }

        try {
            this.algorithm.resetAllCallCounts();
            this.loadInitialData();
            this.updateUI();
            this.updateCurrentTab();
            NotificationSystem.success('统计周期已重置');
        } catch (error) {
            NotificationSystem.error('重置统计周期失败: ' + error.message);
        }
    }

    /**
     * 导出统计报表
     */
    async handleExportStats() {
        try {
            await this.excel.exportStatisticsToExcel();
            NotificationSystem.success('统计报表导出成功');
        } catch (error) {
            NotificationSystem.error('导出失败: ' + error.message);
        }
    }

    /**
     * 清空所有数据
     */
    handleClearData() {
        if (!confirm('确定要清空所有数据吗？\n\n这将删除：\n- 所有学生信息\n- 所有点名历史记录\n- 所有统计数据\n\n此操作不可恢复！')) {
            return;
        }

        // 二次确认
        if (!confirm('最后确认：真的要清空所有数据吗？')) {
            return;
        }

        try {
            // 清空所有数据
            this.storage.clearAllData();

            // 重新加载数据
            this.loadInitialData();
            this.updateUI();
            this.updateCurrentTab();

            NotificationSystem.success('所有数据已清空');
        } catch (error) {
            NotificationSystem.error('清空数据失败: ' + error.message);
        }
    }

    /**
     * 更新 UI 状态
     */
    updateUI() {
        // 更新学生数量显示（如果在其他页面也需要显示）
        if (this.elements.studentCount) {
            this.elements.studentCount.textContent = this.state.students.length;
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '正在处理...') {
        // 如果已有loading元素，先移除
        if (this.loadingElement) {
            this.loadingElement.remove();
        }

        // 创建loading遮罩
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = 'loading-overlay';
        this.loadingElement.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(this.loadingElement);
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.remove();
            this.loadingElement = null;
        }
    }
}

// 初始化应用
let app;

// 确保在 DOM 加载完成后初始化
function initializeApp() {
    if (document.readyState === 'loading') {
        // 如果 DOM 还在加载中，等待加载完成
        document.addEventListener('DOMContentLoaded', () => {
            app = new RollCallApp();
            window.app = app;
        });
    } else {
        // 如果 DOM 已经加载完成，直接初始化
        app = new RollCallApp();
        window.app = app;
    }
}

// 立即尝试初始化
initializeApp();
