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

class DialogService {
    static confirm({
        title = '提示',
        message = '',
        confirmText = '确定',
        cancelText = '取消',
        type = 'info'
    } = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal active confirm-modal';
            overlay.dataset.type = type;

            const content = document.createElement('div');
            content.className = 'modal-content confirm-content';

            const titleElement = document.createElement('h3');
            titleElement.textContent = title;

            const messageContainer = document.createElement('div');
            messageContainer.className = 'confirm-message';
            if (typeof message === 'string') {
                messageContainer.innerHTML = message;
            } else if (message instanceof Node) {
                messageContainer.appendChild(message);
            }

            const buttons = document.createElement('div');
            buttons.className = 'modal-buttons';

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.className = 'btn btn-secondary';
            cancelButton.textContent = cancelText;

            const confirmButton = document.createElement('button');
            confirmButton.type = 'button';
            const confirmClasses = ['btn'];
            if (type === 'danger') {
                confirmClasses.push('btn-danger');
            } else if (type === 'warning') {
                confirmClasses.push('btn-warning');
            } else {
                confirmClasses.push('btn-primary');
            }
            confirmButton.className = confirmClasses.join(' ');
            confirmButton.textContent = confirmText;

            buttons.append(cancelButton, confirmButton);
            content.append(titleElement, messageContainer, buttons);
            overlay.appendChild(content);
            document.body.appendChild(overlay);

            const cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown);
                overlay.remove();
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            const handleKeyDown = (event) => {
                if (event.key === 'Escape') {
                    handleCancel();
                }
                if (event.key === 'Enter') {
                    handleConfirm();
                }
            };

            cancelButton.addEventListener('click', handleCancel);
            confirmButton.addEventListener('click', handleConfirm);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    handleCancel();
                }
            });
            document.addEventListener('keydown', handleKeyDown);

            requestAnimationFrame(() => {
                confirmButton.focus();
            });
        });
    }

    static escapeHtml(text = '') {
        const temp = document.createElement('div');
        temp.textContent = text;
        return temp.innerHTML;
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
        this.elements.importExcelBtn = document.getElementById('import-excel-btn');
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
            e.target.blur();
        });

        // 快捷键支持：空格键开始点名
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.state.activeTab === 'roll-call' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.handleRollCall();
            }
        });

        // 学生管理
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

        if (this.elements.studentsTbody) {
            this.elements.studentsTbody.addEventListener('click', (event) => {
                const deleteButton = event.target.closest('[data-action="delete-student"]');
                if (deleteButton) {
                    this.deleteStudent(deleteButton.dataset.id);
                }
            });
        }

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
        this.elements.rollBtn.classList.add('btn-disabled');

        // 开始滚动动画
        this.startRollingAnimation(() => {
            // 执行点名
            this.state.selectedStudent = this.algorithm.rollCall();

            if (this.state.selectedStudent) {
                this.showSelectedStudent();
                this.updateUI();
            }

            // 动画完成后适时恢复按钮可用
            setTimeout(() => {
                this.enableRollButton();
            }, 900);
        });
    }

    /**
     * 恢复按钮状态（兼容iOS Safari）
     */
    enableRollButton() {
        const btn = this.elements.rollBtn;

        // 移除禁用状态
        btn.disabled = false;
        btn.classList.remove('btn-disabled');

        // 强制移除所有可能的内联样式
        btn.style.opacity = '';
        btn.style.cursor = '';
        btn.style.pointerEvents = '';

        // 强制重绘（iOS Safari需要）
        void btn.offsetHeight;

        // 重新应用正常样式
        btn.style.opacity = '1';

        // 再次强制重绘
        requestAnimationFrame(() => {
            btn.style.opacity = '';
        });
    }

    /**
     * 开始滚动动画 - 随机显示学生名字
     */
    startRollingAnimation(callback) {
        const interval = 45;
        const duration = Math.max(450, Math.min(900, this.state.students.length * 25 + 450));
        const iterations = Math.max(Math.floor(duration / interval), 1);
        let count = 0;
        let rollInterval;

        this.elements.selectedStudent.classList.add('rolling-fast');

        const tick = () => {
            const randomStudent = this.state.students[Math.floor(Math.random() * this.state.students.length)];
            if (randomStudent) {
                this.elements.selectedStudent.innerHTML = `
                    <div class="name rolling-text">${randomStudent.name}</div>
                    <div class="seat rolling-text">座位号：${randomStudent.seat}</div>
                `;
            }

            count += 1;

            if (count >= iterations) {
                clearInterval(rollInterval);
                this.elements.selectedStudent.classList.remove('rolling-fast');
                requestAnimationFrame(callback);
            }
        };

        tick();
        rollInterval = setInterval(tick, interval);
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
            <div class="name">${student.name}</div>
            <div class="seat">座位号：${student.seat}</div>
        `;

        this.elements.studentInfo.innerHTML = `
            该学生本周期内已被点中 <strong>${student.callCount}</strong> 次
        `;

        // 移除动画类
        setTimeout(() => {
            this.elements.selectedStudent.classList.remove('flip-in');
        }, 600);
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
        if (!file) {
            return;
        }

        this.showLoading('正在导入学生名单...');

        try {
            const result = await this.excel.importStudentsFromExcel(file);
            const validation = this.excel.validateStudentData(result.students);

            if (validation.issues.length) {
                const confirmed = await DialogService.confirm({
                    title: '导入数据存在问题',
                    message: this.buildImportValidationMessage(validation),
                    confirmText: '继续导入',
                    cancelText: '取消导入',
                    type: validation.errors.length ? 'danger' : 'warning'
                });

                if (!confirmed) {
                    NotificationSystem.info('导入已取消');
                    return;
                }
            }

            const persisted = this.storage.saveStudents(result.students, {
                resetHistory: true,
                resetStats: true
            });

            if (!persisted) {
                throw new Error('保存学生数据失败');
            }

            NotificationSystem.success(`成功导入 ${result.count} 名学生`);

            if (validation.errors.length) {
                NotificationSystem.info(`导入仍包含 ${validation.errors.length} 个错误，请尽快修复数据`);
            } else if (validation.warnings.length) {
                NotificationSystem.info(`检测到 ${validation.warnings.length} 个警告，请检查导入数据`);
            }

            this.loadInitialData();
            this.updateUI();
            this.updateCurrentTab();
        } catch (error) {
            NotificationSystem.error('导入失败: ' + error.message);
        } finally {
            this.elements.importExcel.value = '';
            this.hideLoading();
        }
    }

    buildImportValidationMessage(validation) {
        const issues = validation.issues
            .map(issue => `<li>${DialogService.escapeHtml(issue.message)}</li>`)
            .join('');

        const counts = [];
        if (validation.errors.length) {
            counts.push(`${validation.errors.length} 个错误`);
        }
        if (validation.warnings.length) {
            counts.push(`${validation.warnings.length} 个警告`);
        }
        const summary = counts.length ? `发现 ${counts.join('、')}：` : '检测到以下问题：';
        const notice = validation.errors.length
            ? '<p class="confirm-alert">存在严重错误，建议修复后再导入，继续导入将覆盖当前学生名单。</p>'
            : '<p class="confirm-alert">继续导入将覆盖当前学生名单，请确认。</p>';

        return `
            <p>${summary}</p>
            <ul class="confirm-issues">
                ${issues}
            </ul>
            ${notice}
        `;
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
                    <button class="btn btn-sm btn-danger" data-action="delete-student" data-id="${student.id}">删除</button>
                </td>
            </tr>
        `).join('');

        this.elements.studentsTbody.innerHTML = tbodyHTML;
    }

    /**
     * 删除学生
     */
    async deleteStudent(studentId) {
        const student = this.storage.getStudentById(studentId);
        if (!student) {
            NotificationSystem.error('学生不存在');
            return;
        }

        const message = `
            <p>确认删除以下学生？该操作不可撤销。</p>
            <div class="confirm-student">
                <p><strong>姓名：</strong>${DialogService.escapeHtml(student.name)}</p>
                <p><strong>座位号：</strong>${DialogService.escapeHtml(String(student.seat))}</p>
                <p><strong>当前被点次数：</strong>${student.callCount || 0}</p>
            </div>
        `;

        const confirmed = await DialogService.confirm({
            title: '删除学生',
            message,
            confirmText: '删除',
            cancelText: '保留',
            type: 'danger'
        });

        if (!confirmed) {
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
    async handleResetStats() {
        const confirmed = await DialogService.confirm({
            title: '重置统计周期',
            message: '<p>重置后将清零所有学生的被点名次数并清空点名历史。</p>',
            confirmText: '立即重置',
            cancelText: '取消',
            type: 'warning'
        });

        if (!confirmed) {
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
    async handleClearData() {
        const confirmed = await DialogService.confirm({
            title: '清空所有数据',
            message: `
                <p>该操作将删除以下内容：</p>
                <ul class="confirm-issues">
                    <li>所有学生信息</li>
                    <li>全部点名历史</li>
                    <li>统计数据与备份</li>
                </ul>
                <p class="confirm-alert">此操作不可恢复，请谨慎执行。</p>
            `,
            confirmText: '彻底清空',
            cancelText: '保留数据',
            type: 'danger'
        });

        if (!confirmed) {
            return;
        }

        try {
            this.storage.clearAllData();
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
