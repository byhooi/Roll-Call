/**
 * 简单的通知系统
 */
class NotificationSystem {
    static show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

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
        temp.textContent = String(text);
        return temp.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

/**
 * 纯原生 Web Audio API 音效管理器（无需外部音频文件）
 */
class SoundManager {
    constructor() {
        this.audioCtx = null;
        let isEnabled = true;
        try {
            isEnabled = localStorage.getItem('roll-call-sound') !== 'false';
        } catch (e) {}
        this.enabled = isEnabled;
    }

    initContext() {
        if (!this.audioCtx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.audioCtx = new AudioCtx();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playTick() {
        if (!this.enabled) return;
        try {
            this.initContext();
            if (!this.audioCtx) return;
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(860, now);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.035);
        } catch (e) {}
    }

    playWin() {
        if (!this.enabled) return;
        try {
            this.initContext();
            if (!this.audioCtx) return;
            const now = this.audioCtx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                const startTime = now + idx * 0.07;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.08, startTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.35);
            });
        } catch (e) {}
    }

    toggle() {
        this.enabled = !this.enabled;
        try {
            localStorage.setItem('roll-call-sound', this.enabled ? 'true' : 'false');
        } catch (e) {}
        return this.enabled;
    }
}

/**
 * 原生 Web Speech 语音播报管理器
 */
class VoiceAnnouncer {
    constructor() {
        let isEnabled = false;
        try {
            isEnabled = localStorage.getItem('roll-call-voice') === 'true';
        } catch (e) {}
        this.enabled = isEnabled;
    }

    speak(text) {
        if (!this.enabled || typeof window === 'undefined' || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            utterance.rate = 1.05;
            window.speechSynthesis.speak(utterance);
        } catch (e) {}
    }

    toggle() {
        this.enabled = !this.enabled;
        try {
            localStorage.setItem('roll-call-voice', this.enabled ? 'true' : 'false');
        } catch (e) {}
        return this.enabled;
    }
}

// 创建 RollCallApp 类
class RollCallApp {
    constructor() {
        this.storage = storage;
        this.algorithm = algorithm;
        this.excel = excel;
        this.sound = new SoundManager();
        this.voice = new VoiceAnnouncer();

        // 缓存 DOM 元素
        this.elements = {};

        // 当前状态
        this.state = {
            activeTab: 'roll-call',
            students: [],
            callHistory: [],
            stats: {},
            selectedStudent: null,
            selectedMultiple: [],
            rollCount: 1,
            studentSearch: '',
            studentSort: 'seat-asc',
            statsView: 'cards' // 'cards' 或 'history'
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
        this.restoreTheme();
        this.updateToolButtonsState();
        this.updateUI();
    }

    /**
     * 缓存 DOM 元素
     */
    cacheElements() {
        // 主要容器与顶栏
        this.elements.container = document.getElementById('app-container') || document.querySelector('.container');
        this.elements.tabs = document.querySelectorAll('.nav-btn');
        this.elements.tabContents = document.querySelectorAll('.view-section');

        // 顶栏工具
        this.elements.toggleSoundBtn = document.getElementById('toggle-sound-btn');
        this.elements.toggleVoiceBtn = document.getElementById('toggle-voice-btn');
        this.elements.toggleThemeBtn = document.getElementById('toggle-theme-btn');
        this.elements.toggleFullscreenBtn = document.getElementById('toggle-fullscreen-btn');

        // 点名页面
        this.elements.rollBtn = document.getElementById('roll-btn');
        this.elements.selectedStudent = document.getElementById('selected-student');
        this.elements.studentInfo = document.getElementById('student-info');
        this.elements.rollStatus = document.getElementById('roll-status');
        this.elements.modeChips = document.querySelectorAll('.mode-chip');

        // 学生管理页面
        this.elements.importExcel = document.getElementById('import-excel');
        this.elements.importExcelBtn = document.getElementById('import-excel-btn');
        this.elements.downloadTemplateBtn = document.getElementById('download-template-btn');
        this.elements.loadSampleBtn = document.getElementById('load-sample-btn');
        this.elements.addStudentBtn = document.getElementById('add-student-btn');
        this.elements.clearDataBtn = document.getElementById('clear-data-btn');
        this.elements.studentCount = document.getElementById('student-count');
        this.elements.studentsTbody = document.getElementById('students-tbody');
        this.elements.studentsSearch = document.getElementById('students-search');
        this.elements.studentsSort = document.getElementById('students-sort');
        this.elements.dropZone = document.getElementById('table-drop-zone');

        // 统计分析页面
        this.elements.resetStatsBtn = document.getElementById('reset-stats-btn');
        this.elements.exportStatsBtn = document.getElementById('export-stats-btn');
        this.elements.exportBackupBtn = document.getElementById('export-backup-btn');
        this.elements.totalCalls = document.getElementById('total-calls');
        this.elements.totalStudents = document.getElementById('total-students');
        this.elements.avgCalls = document.getElementById('avg-calls');
        this.elements.coverageRate = document.getElementById('coverage-rate');
        this.elements.distributionBar = document.getElementById('distribution-bar');
        this.elements.statsGrid = document.getElementById('stats-grid');
        this.elements.statsHistoryList = document.getElementById('stats-history-list');
        this.elements.statsViewCards = document.getElementById('stats-view-cards');
        this.elements.statsViewHistory = document.getElementById('stats-view-history');
        this.elements.statsSearch = document.getElementById('stats-search');

        // 弹窗
        this.elements.addStudentModal = document.getElementById('add-student-modal');
        this.elements.addStudentForm = document.getElementById('add-student-form');
        this.elements.cancelAddBtn = document.getElementById('cancel-add-btn');

        this.elements.editStudentModal = document.getElementById('edit-student-modal');
        this.elements.editStudentForm = document.getElementById('edit-student-form');
        this.elements.cancelEditBtn = document.getElementById('cancel-edit-btn');
        this.elements.editStudentId = document.getElementById('edit-student-id');
        this.elements.editStudentName = document.getElementById('edit-student-name');
        this.elements.editStudentSeat = document.getElementById('edit-student-seat');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 关键：注册的第一个 keydown 监听器必须是空格键点名，以满足自动化回归测试
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey
                && this.state.activeTab === 'roll-call'
                && !e.target.closest('input, textarea, select, button, [contenteditable]')
                && !document.querySelector('.confirm-modal, .modal-overlay.active, .loading-overlay')) {
                e.preventDefault();
                this.handleRollCall();
            }
        });

        // 顶栏标签页切换
        if (this.elements.tabs) {
            this.elements.tabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    this.switchTab(e.currentTarget.dataset.tab);
                });
            });
        }

        // 点名按钮
        if (this.elements.rollBtn) {
            this.elements.rollBtn.addEventListener('click', () => {
                if (this.elements.rollBtn.disabled) return;
                this.handleRollCall();
                this.elements.rollBtn.blur();
            });
        }

        // 顶栏辅助工具按钮
        if (this.elements.toggleSoundBtn) {
            this.elements.toggleSoundBtn.addEventListener('click', () => {
                const active = this.sound.toggle();
                this.updateToolButtonsState();
                NotificationSystem.info(active ? '已开启音效' : '已静音');
            });
        }

        if (this.elements.toggleVoiceBtn) {
            this.elements.toggleVoiceBtn.addEventListener('click', () => {
                const active = this.voice.toggle();
                this.updateToolButtonsState();
                NotificationSystem.info(active ? '已开启姓名语音播报' : '已关闭语音播报');
            });
        }

        if (this.elements.toggleThemeBtn) {
            this.elements.toggleThemeBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        if (this.elements.toggleFullscreenBtn) {
            this.elements.toggleFullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // 全屏状态改变事件
        document.addEventListener('fullscreenchange', () => {
            const isFull = !!document.fullscreenElement;
            document.body.classList.toggle('is-fullscreen', isFull);
            if (this.elements.toggleFullscreenBtn) {
                this.elements.toggleFullscreenBtn.classList.toggle('active', isFull);
            }
        });

        // 点名人数选择器
        if (this.elements.modeChips && typeof this.elements.modeChips.forEach === 'function') {
            this.elements.modeChips.forEach(chip => {
                chip.addEventListener('click', (e) => {
                    this.setRollMode(parseInt(e.currentTarget.dataset.count, 10) || 1);
                });
            });
        }

        // 学生管理：导入 Excel
        if (this.elements.importExcel) {
            this.elements.importExcel.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleImportExcel(e.target.files[0]);
                }
            });
        }

        if (this.elements.importExcelBtn) {
            this.elements.importExcelBtn.addEventListener('click', () => {
                if (this.elements.importExcel) this.elements.importExcel.click();
            });
        }

        // 下载导入模板
        if (this.elements.downloadTemplateBtn) {
            this.elements.downloadTemplateBtn.addEventListener('click', () => {
                try {
                    this.excel.downloadTemplate();
                    NotificationSystem.success('导入模板下载成功');
                } catch (err) {
                    NotificationSystem.error('下载模板失败: ' + err.message);
                }
            });
        }

        // 加载演示名单
        if (this.elements.loadSampleBtn) {
            this.elements.loadSampleBtn.addEventListener('click', () => {
                this.handleLoadSampleStudents();
            });
        }

        // 手动添加学生
        if (this.elements.addStudentBtn) {
            this.elements.addStudentBtn.addEventListener('click', () => {
                this.showAddStudentModal();
            });
        }

        // 清空数据
        if (this.elements.clearDataBtn) {
            this.elements.clearDataBtn.addEventListener('click', () => {
                this.handleClearData();
            });
        }

        // 学生管理表格事件（委托：编辑和删除）
        if (this.elements.studentsTbody) {
            this.elements.studentsTbody.addEventListener('click', (event) => {
                const deleteButton = event.target.closest('[data-action="delete-student"]');
                if (deleteButton) {
                    this.deleteStudent(deleteButton.dataset.id);
                    return;
                }
                const editButton = event.target.closest('[data-action="edit-student"]');
                if (editButton) {
                    this.showEditStudentModal(editButton.dataset.id);
                }
            });
        }

        // 学生管理：搜索与排序
        if (this.elements.studentsSearch) {
            this.elements.studentsSearch.addEventListener('input', (e) => {
                this.state.studentSearch = e.target.value.trim().toLowerCase();
                this.updateStudentList();
            });
        }

        if (this.elements.studentsSort) {
            this.elements.studentsSort.addEventListener('change', (e) => {
                this.state.studentSort = e.target.value;
                this.updateStudentList();
            });
        }

        // 拖拽上传 Excel 文件
        if (this.elements.dropZone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                this.elements.dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.elements.dropZone.classList.add('drag-over');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                this.elements.dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.elements.dropZone.classList.remove('drag-over');
                });
            });

            this.elements.dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer && e.dataTransfer.files;
                if (files && files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        this.handleImportExcel(file);
                    } else {
                        NotificationSystem.error('请拖入 .xlsx 或 .xls 格式的表格文件');
                    }
                }
            });
        }

        // 统计页面操作
        if (this.elements.resetStatsBtn) {
            this.elements.resetStatsBtn.addEventListener('click', () => {
                this.handleResetStats();
            });
        }

        if (this.elements.exportStatsBtn) {
            this.elements.exportStatsBtn.addEventListener('click', () => {
                this.handleExportStats();
            });
        }

        if (this.elements.exportBackupBtn) {
            this.elements.exportBackupBtn.addEventListener('click', () => {
                try {
                    this.excel.exportDataBackup();
                    NotificationSystem.success('数据备份导出成功');
                } catch (e) {
                    NotificationSystem.error('备份失败: ' + e.message);
                }
            });
        }

        if (this.elements.statsSearch) {
            this.elements.statsSearch.addEventListener('input', () => {
                this.updateStatistics();
            });
        }

        if (this.elements.statsViewCards && this.elements.statsViewHistory) {
            this.elements.statsViewCards.addEventListener('click', () => {
                this.setStatsView('cards');
            });
            this.elements.statsViewHistory.addEventListener('click', () => {
                this.setStatsView('history');
            });
        }

        // 添加学生弹窗提交与关闭
        if (this.elements.addStudentForm) {
            this.elements.addStudentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddStudent();
            });
        }

        if (this.elements.cancelAddBtn) {
            this.elements.cancelAddBtn.addEventListener('click', () => {
                this.hideAddStudentModal();
            });
        }

        // 编辑学生弹窗提交与关闭
        if (this.elements.editStudentForm) {
            this.elements.editStudentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditStudent();
            });
        }

        if (this.elements.cancelEditBtn) {
            this.elements.cancelEditBtn.addEventListener('click', () => {
                this.hideEditStudentModal();
            });
        }

        // 键盘快捷键：ESC 关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.elements.addStudentModal && this.elements.addStudentModal.classList.contains('active')) {
                    this.hideAddStudentModal();
                }
                if (this.elements.editStudentModal && this.elements.editStudentModal.classList.contains('active')) {
                    this.hideEditStudentModal();
                }
            }
        });

        // 点击遮罩外部关闭
        if (this.elements.addStudentModal) {
            this.elements.addStudentModal.addEventListener('click', (e) => {
                if (e.target === this.elements.addStudentModal) {
                    this.hideAddStudentModal();
                }
            });
        }

        if (this.elements.editStudentModal) {
            this.elements.editStudentModal.addEventListener('click', (e) => {
                if (e.target === this.elements.editStudentModal) {
                    this.hideEditStudentModal();
                }
            });
        }

        // 表单验证反馈
        this.setupFormValidation();
    }

    /**
     * 设置点名抽选人数
     */
    setRollMode(count) {
        this.state.rollCount = count;
        if (this.elements.modeChips && typeof this.elements.modeChips.forEach === 'function') {
            this.elements.modeChips.forEach(chip => {
                const c = parseInt(chip.dataset.count, 10);
                chip.classList.toggle('active', c === count);
            });
        }
    }

    /**
     * 切换主题（浅色/深色）
     */
    toggleTheme() {
        const isLight = document.body.classList.toggle('light-theme');
        try {
            localStorage.setItem('roll-call-theme', isLight ? 'light' : 'dark');
        } catch (e) {}
        NotificationSystem.info(isLight ? '已切换至浅色日间模式' : '已切换至深色极客模式');
    }

    /**
     * 恢复已保存的主题
     */
    restoreTheme() {
        try {
            const savedTheme = localStorage.getItem('roll-call-theme');
            if (savedTheme === 'light') {
                document.body.classList.add('light-theme');
            }
        } catch (e) {}
    }

    /**
     * 更新顶栏工具按钮的激活状态
     */
    updateToolButtonsState() {
        if (this.elements.toggleSoundBtn) {
            this.elements.toggleSoundBtn.classList.toggle('active', this.sound.enabled);
        }
        if (this.elements.toggleVoiceBtn) {
            this.elements.toggleVoiceBtn.classList.toggle('active', this.voice.enabled);
        }
    }

    /**
     * 全屏切换
     */
    toggleFullscreen() {
        try {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        } catch (e) {}
    }

    /**
     * 设置表单验证和实时反馈
     */
    setupFormValidation() {
        const nameInput = document.getElementById('student-name');
        const seatInput = document.getElementById('student-seat');
        if (!nameInput || !seatInput) return;

        nameInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value.length > 0 && value.length < 2) {
                e.target.style.borderColor = '#ffa502';
                e.target.title = '姓名至少需要2个字符';
            } else if (value.length >= 2) {
                e.target.style.borderColor = '#2ed573';
                e.target.title = '';
            } else {
                e.target.style.borderColor = '';
                e.target.title = '';
            }
        });

        seatInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            if (value && value > 0) {
                e.target.style.borderColor = '#2ed573';
                e.target.title = '';
            } else if (value === 0) {
                e.target.style.borderColor = '#ffa502';
                e.target.title = '座位号必须大于0';
            } else {
                e.target.style.borderColor = '';
                e.target.title = '';
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
        this.state.activeTab = tabName;

        if (this.elements.tabs) {
            this.elements.tabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
        }

        if (this.elements.tabContents) {
            this.elements.tabContents.forEach(content => {
                content.classList.toggle('active', content.id === tabName);
            });
        }

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
     * 处理点名（支持单人及连抽模式）
     */
    handleRollCall() {
        if (this.elements.rollBtn.disabled) return;
        this.loadInitialData();
        if (this.state.students.length === 0) {
            NotificationSystem.error('请先导入学生名单');
            return;
        }

        // 禁用按钮防止重复点击
        this.elements.rollBtn.disabled = true;
        this.elements.rollBtn.classList.add('btn-disabled');

        if (this.elements.rollStatus) {
            this.elements.rollStatus.textContent = '点名进行中...';
            this.elements.rollStatus.className = 'status-badge rolling';
        }

        const count = Math.min(this.state.rollCount || 1, this.state.students.length);

        // 开始滚动动画
        this.startRollingAnimation(count, () => {
            try {
                if (count === 1) {
                    this.state.selectedStudent = this.algorithm.rollCall();
                    this.state.selectedMultiple = this.state.selectedStudent ? [this.state.selectedStudent] : [];
                } else {
                    this.state.selectedMultiple = this.algorithm.rollCallMultiple(count);
                    this.state.selectedStudent = this.state.selectedMultiple[0] || null;
                }

                if (this.state.selectedMultiple.length > 0) {
                    this.loadInitialData();
                    this.showSelectedStudents(count);
                    this.updateUI();
                    if (this.elements.rollStatus) {
                        this.elements.rollStatus.textContent = '点名完成';
                        this.elements.rollStatus.className = 'status-badge completed';
                    }

                    // 播放揭晓和弦音与语音播报
                    this.sound.playWin();
                    if (count === 1 && this.state.selectedStudent) {
                        this.voice.speak(`${this.state.selectedStudent.name} 同学`);
                    } else {
                        const names = this.state.selectedMultiple.map(s => s.name).join('，');
                        this.voice.speak(names);
                    }
                } else {
                    throw new Error('没有可点名的学生，请检查名单后重试');
                }
            } catch (error) {
                this.state.selectedStudent = null;
                this.state.selectedMultiple = [];
                if (this.elements.rollStatus) {
                    this.elements.rollStatus.textContent = '点名失败，请重试';
                    this.elements.rollStatus.className = 'status-badge failed';
                }
                if (this.elements.selectedStudent) {
                    this.elements.selectedStudent.textContent = '点名未保存，请重试';
                }
                if (this.elements.studentInfo) {
                    this.elements.studentInfo.textContent = '';
                }
                NotificationSystem.error(error.message);
            } finally {
                this.enableRollButton();
            }
        });
    }

    /**
     * 恢复按钮状态
     */
    enableRollButton() {
        const btn = this.elements.rollBtn;
        if (!btn) return;
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
        btn.removeAttribute('style');
    }

    /**
     * 开始滚动动画
     */
    startRollingAnimation(count, callback) {
        const interval = 45;
        const duration = Math.max(500, Math.min(950, this.state.students.length * 20 + 450));
        const iterations = Math.max(Math.floor(duration / interval), 1);
        let currentIter = 0;
        let rollInterval;

        this.elements.selectedStudent.classList.add('rolling-fast');

        const tick = () => {
            this.sound.playTick();

            if (count === 1) {
                const randomStudent = this.state.students[Math.floor(Math.random() * this.state.students.length)];
                if (randomStudent) {
                    this.elements.selectedStudent.innerHTML = `
                        <div class="name rolling-text">${DialogService.escapeHtml(randomStudent.name)}</div>
                        <div class="seat rolling-text">座位号：${DialogService.escapeHtml(randomStudent.seat)}</div>
                    `;
                }
            } else {
                // 多人随机闪烁
                const picked = [];
                for (let i = 0; i < count; i++) {
                    const s = this.state.students[Math.floor(Math.random() * this.state.students.length)];
                    if (s) picked.push(s);
                }
                this.elements.selectedStudent.innerHTML = `
                    <div class="multi-roll-grid">
                        ${picked.map(s => `
                            <div class="multi-student-card">
                                <span class="card-seat">座位 ${DialogService.escapeHtml(s.seat)}</span>
                                <span class="card-name">${DialogService.escapeHtml(s.name)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            currentIter += 1;
            if (currentIter >= iterations) {
                clearInterval(rollInterval);
                this.elements.selectedStudent.classList.remove('rolling-fast');
                requestAnimationFrame(callback);
            }
        };

        tick();
        rollInterval = setInterval(tick, interval);
    }

    /**
     * 显示选中的学生（单人/多人）
     */
    showSelectedStudents(count) {
        this.createParticleExplosion();
        this.elements.selectedStudent.classList.add('flip-in');

        if (count === 1 && this.state.selectedStudent) {
            const student = this.state.selectedStudent;
            this.elements.selectedStudent.innerHTML = `
                <div class="name">${DialogService.escapeHtml(student.name)}</div>
                <div class="seat">座位号：${DialogService.escapeHtml(student.seat)}</div>
            `;
            this.elements.studentInfo.innerHTML = `
                该学生本周期内已被点中 <strong>${DialogService.escapeHtml(student.callCount)}</strong> 次
            `;
        } else {
            const list = this.state.selectedMultiple;
            this.elements.selectedStudent.innerHTML = `
                <div class="multi-roll-grid">
                    ${list.map(s => `
                        <div class="multi-student-card flip-in">
                            <span class="card-seat">座位号：${DialogService.escapeHtml(s.seat)}</span>
                            <span class="card-name">${DialogService.escapeHtml(s.name)}</span>
                            <span class="card-count">本周期被点 ${DialogService.escapeHtml(s.callCount)} 次</span>
                        </div>
                    `).join('')}
                </div>
            `;
            this.elements.studentInfo.innerHTML = `
                本次共抽选 <strong>${list.length}</strong> 名同学回答问题
            `;
        }

        setTimeout(() => {
            this.elements.selectedStudent.classList.remove('flip-in');
        }, 650);
    }

    /**
     * 创建粒子爆炸礼花效果
     */
    createParticleExplosion() {
        const resultDisplay = document.querySelector('.roll-display-area');
        if (!resultDisplay) return;
        const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#ffd166', '#ff4757'];

        for (let i = 0; i < 36; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];

            const angle = (Math.PI * 2 * i) / 36;
            const velocity = 120 + Math.random() * 120;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);

            resultDisplay.appendChild(particle);

            setTimeout(() => {
                particle.remove();
            }, 900);
        }
    }

    /**
     * 导入 Excel 文件
     */
    async handleImportExcel(file) {
        if (!file) return;

        this.showLoading('正在解析并导入学生名单...');

        try {
            const result = await this.excel.importStudentsFromExcel(file);
            const validation = this.excel.validateStudentData(result.students);

            if (validation.issues.length) {
                // 等待用户确认前移除加载遮罩，避免挡住确认框。
                this.hideLoading();
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
            if (this.elements.importExcel) this.elements.importExcel.value = '';
            this.hideLoading();
        }
    }

    /**
     * 一键加载演示学生名单
     */
    async handleLoadSampleStudents() {
        if (this.state.students.length > 0) {
            const confirmed = await DialogService.confirm({
                title: '加载演示名单',
                message: '<p>当前已有学生数据。加载示例名单将覆盖现有名单并重置点名历史，确认继续？</p>',
                confirmText: '确认载入',
                cancelText: '取消',
                type: 'warning'
            });
            if (!confirmed) return;
        }

        const sample = this.excel.getSampleStudents();
        const persisted = this.storage.saveStudents(sample, {
            resetHistory: true,
            resetStats: true
        });

        if (persisted) {
            NotificationSystem.success(`已载入 ${sample.length} 名示例学生数据`);
            this.loadInitialData();
            this.updateUI();
            this.updateCurrentTab();
        } else {
            NotificationSystem.error('载入示例数据失败');
        }
    }

    buildImportValidationMessage(validation) {
        const issues = validation.issues
            .map(issue => `<li>${DialogService.escapeHtml(issue.message)}</li>`)
            .join('');

        const counts = [];
        if (validation.errors.length) counts.push(`${validation.errors.length} 个错误`);
        if (validation.warnings.length) counts.push(`${validation.warnings.length} 个警告`);
        const summary = counts.length ? `发现 ${counts.join('、')}：` : '检测到以下问题：';
        const notice = validation.errors.length
            ? '<p class="confirm-alert">存在严重错误，建议修复后再导入，继续导入将覆盖当前学生名单。</p>'
            : '<p class="confirm-alert">继续导入将覆盖当前学生名单，请确认。</p>';

        return `
            <p>${summary}</p>
            <ul class="confirm-issues">${issues}</ul>
            ${notice}
        `;
    }

    /**
     * 显示添加学生弹窗
     */
    showAddStudentModal() {
        if (this.elements.addStudentModal) {
            this.elements.addStudentModal.classList.add('active');
            if (this.elements.addStudentForm) this.elements.addStudentForm.reset();
        }
    }

    /**
     * 隐藏添加学生弹窗
     */
    hideAddStudentModal() {
        if (this.elements.addStudentModal) {
            this.elements.addStudentModal.classList.remove('active');
        }
    }

    /**
     * 手动添加学生
     */
    async handleAddStudent() {
        const nameInput = document.getElementById('student-name');
        const seatInput = document.getElementById('student-seat');
        const name = nameInput ? nameInput.value.trim() : '';
        const seat = seatInput ? Number(seatInput.value) : 0;

        if (!name || !Number.isSafeInteger(seat) || seat <= 0) {
            NotificationSystem.error('请填写完整的学生信息，座位号必须为正整数');
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
     * 显示编辑学生弹窗
     */
    showEditStudentModal(studentId) {
        const student = this.storage.getStudentById(studentId);
        if (!student) {
            NotificationSystem.error('未找到该学生');
            return;
        }

        if (this.elements.editStudentId) this.elements.editStudentId.value = student.id;
        if (this.elements.editStudentName) this.elements.editStudentName.value = student.name;
        if (this.elements.editStudentSeat) this.elements.editStudentSeat.value = student.seat;

        if (this.elements.editStudentModal) {
            this.elements.editStudentModal.classList.add('active');
        }
    }

    /**
     * 隐藏编辑学生弹窗
     */
    hideEditStudentModal() {
        if (this.elements.editStudentModal) {
            this.elements.editStudentModal.classList.remove('active');
        }
    }

    /**
     * 保存学生修改
     */
    async handleEditStudent() {
        const id = this.elements.editStudentId ? this.elements.editStudentId.value : '';
        const name = this.elements.editStudentName ? this.elements.editStudentName.value.trim() : '';
        const seat = this.elements.editStudentSeat ? Number(this.elements.editStudentSeat.value) : 0;

        if (!id || !name || !Number.isSafeInteger(seat) || seat <= 0) {
            NotificationSystem.error('请填写完整且合法的姓名与座位号');
            return;
        }

        try {
            const success = this.storage.editStudent(id, { name, seat });
            if (!success) {
                throw new Error('学生信息未保存，请检查浏览器存储空间后重试');
            }
            if (success) {
                NotificationSystem.success('学生信息已更新');
                this.hideEditStudentModal();
                this.loadInitialData();
                this.updateUI();
                this.updateCurrentTab();
            }
        } catch (error) {
            NotificationSystem.error('修改失败: ' + error.message);
        }
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
                <p><strong>当前被点次数：</strong>${DialogService.escapeHtml(student.callCount || 0)}</p>
            </div>
        `;

        const confirmed = await DialogService.confirm({
            title: '删除学生',
            message,
            confirmText: '删除',
            cancelText: '保留',
            type: 'danger'
        });

        if (!confirmed) return;

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
     * 更新学生管理页面
     */
    updateStudentsTab() {
        this.updateStudentList();
    }

    /**
     * 更新学生列表显示（支持搜索与排序）
     */
    updateStudentList() {
        if (this.elements.studentCount) {
            this.elements.studentCount.textContent = this.state.students.length;
        }

        if (this.state.students.length === 0) {
            if (this.elements.studentsTbody) {
                this.elements.studentsTbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            <div class="empty-content">
                                <span class="empty-icon">📂</span>
                                <p>暂无数据，请先导入或点击上方“示例”体验</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
            return;
        }

        // 筛选
        let list = [...this.state.students];
        if (this.state.studentSearch) {
            list = list.filter(s =>
                s.name.toLowerCase().includes(this.state.studentSearch) ||
                String(s.seat).includes(this.state.studentSearch)
            );
        }

        // 排序
        switch (this.state.studentSort) {
            case 'seat-asc':
                list.sort((a, b) => a.seat - b.seat);
                break;
            case 'seat-desc':
                list.sort((a, b) => b.seat - a.seat);
                break;
            case 'name-asc':
                list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                break;
            case 'calls-desc':
                list.sort((a, b) => (b.callCount || 0) - (a.callCount || 0));
                break;
            case 'calls-asc':
                list.sort((a, b) => (a.callCount || 0) - (b.callCount || 0));
                break;
        }

        if (list.length === 0) {
            if (this.elements.studentsTbody) {
                this.elements.studentsTbody.innerHTML = `
                    <tr><td colspan="5" class="empty-state">未找到匹配的学生</td></tr>
                `;
            }
            return;
        }

        const tbodyHTML = list.map(student => {
            const timeStr = student.lastCall
                ? new Date(student.lastCall).toLocaleString('zh-CN', {
                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                })
                : '从未被点';

            return `
                <tr>
                    <td><strong>${DialogService.escapeHtml(student.seat)}</strong></td>
                    <td>${DialogService.escapeHtml(student.name)}</td>
                    <td><span class="call-badge">${DialogService.escapeHtml(student.callCount || 0)} 次</span></td>
                    <td><span style="opacity:0.75; font-size:0.85rem;">${DialogService.escapeHtml(timeStr)}</span></td>
                    <td class="table-ops">
                        <button class="btn-sm btn-edit" data-action="edit-student" data-id="${DialogService.escapeHtml(student.id)}">编辑</button>
                        <button class="btn-sm btn-danger" data-action="delete-student" data-id="${DialogService.escapeHtml(student.id)}">删除</button>
                    </td>
                </tr>
            `;
        }).join('');

        if (this.elements.studentsTbody) {
            this.elements.studentsTbody.innerHTML = tbodyHTML;
        }
    }

    /**
     * 更新统计分析页面
     */
    updateStatisticsTab() {
        this.updateStatistics();
    }

    /**
     * 切换统计视图（学生卡片 vs 最近流水）
     */
    setStatsView(view) {
        this.state.statsView = view;
        if (this.elements.statsViewCards && this.elements.statsViewHistory) {
            this.elements.statsViewCards.classList.toggle('active', view === 'cards');
            this.elements.statsViewHistory.classList.toggle('active', view === 'history');
        }
        if (this.elements.statsGrid) {
            this.elements.statsGrid.style.display = view === 'cards' ? 'grid' : 'none';
        }
        if (this.elements.statsHistoryList) {
            this.elements.statsHistoryList.style.display = view === 'history' ? 'block' : 'none';
        }
        this.updateStatistics();
    }

    /**
     * 更新统计信息及分布概览
     */
    updateStatistics() {
        const stats = this.algorithm.getStudentStats();

        if (this.elements.totalCalls) this.elements.totalCalls.textContent = stats.totalCalls;
        if (this.elements.totalStudents) this.elements.totalStudents.textContent = stats.totalStudents;
        if (this.elements.avgCalls) this.elements.avgCalls.textContent = stats.averageCalls.toFixed(1);

        // 点名覆盖率
        if (this.elements.coverageRate) {
            if (stats.totalStudents > 0) {
                const calledStudents = stats.students.filter(s => (s.callCount || 0) > 0).length;
                const rate = Math.round((calledStudents / stats.totalStudents) * 100);
                this.elements.coverageRate.textContent = `${rate}%`;
            } else {
                this.elements.coverageRate.textContent = '0%';
            }
        }

        // 点名分布条
        if (this.elements.distributionBar) {
            const dist = stats.callDistribution;
            const entries = Object.entries(dist).sort((a, b) => Number(a[0]) - Number(b[0]));
            if (entries.length === 0 || stats.totalStudents === 0) {
                this.elements.distributionBar.innerHTML = '<span class="empty-subtext">暂无分布数据</span>';
            } else {
                this.elements.distributionBar.innerHTML = entries.map(([count, num]) => {
                    const pct = Math.round((num / stats.totalStudents) * 100);
                    return `
                        <div class="distribution-chip">
                            <span class="chip-count">${DialogService.escapeHtml(count)} 次</span>
                            <span class="chip-students">${DialogService.escapeHtml(num)} 人</span>
                            <span class="chip-percent">${pct}%</span>
                        </div>
                    `;
                }).join('');
            }
        }

        // 卡片列表视图
        const searchInput = document.getElementById('stats-search');
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

        if (this.elements.statsGrid) {
            if (stats.totalStudents === 0) {
                this.elements.statsGrid.innerHTML = '<div class="empty-state">暂无统计数据</div>';
            } else {
                let filtered = stats.students;
                if (searchTerm) {
                    filtered = stats.students.filter(s =>
                        s.name.toLowerCase().includes(searchTerm) ||
                        String(s.seat).includes(searchTerm)
                    );
                }

                if (filtered.length === 0) {
                    this.elements.statsGrid.innerHTML = '<div class="empty-state">未找到匹配的学生</div>';
                } else {
                    this.elements.statsGrid.innerHTML = filtered.map(student => `
                        <div class="stat-item-card">
                            <div class="stat-item-header">
                                <div class="stat-seat">座位号：${DialogService.escapeHtml(student.seat)}</div>
                                <span class="stat-call-count">${DialogService.escapeHtml(student.callCount)} 次</span>
                            </div>
                            <div class="stat-item-body">
                                <div class="stat-name">${DialogService.escapeHtml(student.name)}</div>
                            </div>
                            <div class="stat-item-footer">
                                <div class="stat-last-call">
                                    最后点名：${student.lastCall ?
                                        new Date(student.lastCall).toLocaleString('zh-CN', {
                                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                        }) : '从未被点'}
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        }

        // 点名流水表格视图
        if (this.elements.statsHistoryList) {
            const history = this.state.callHistory || [];
            if (history.length === 0) {
                this.elements.statsHistoryList.innerHTML = '<div class="empty-state">暂无点名历史流水</div>';
            } else {
                let filteredHistory = history;
                if (searchTerm) {
                    filteredHistory = history.filter(h =>
                        (h.studentName || '').toLowerCase().includes(searchTerm) ||
                        String(h.studentSeat || '').includes(searchTerm)
                    );
                }

                this.elements.statsHistoryList.innerHTML = `
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>序号</th>
                                <th>座位号</th>
                                <th>姓名</th>
                                <th>点名时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredHistory.slice(0, 100).map((record, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td><strong>${DialogService.escapeHtml(record.studentSeat)}</strong></td>
                                    <td>${DialogService.escapeHtml(record.studentName)}</td>
                                    <td>${DialogService.escapeHtml(record.timestamp ? new Date(record.timestamp).toLocaleString('zh-CN') : record.date)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
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

        if (!confirmed) return;

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

        if (!confirmed) return;

        try {
            if (!this.storage.clearAllData()) {
                throw new Error('无法保存清空后的数据');
            }
            this.loadInitialData();
            this.updateUI();
            this.updateCurrentTab();
            NotificationSystem.success('所有数据已清空');
        } catch (error) {
            NotificationSystem.error('清空数据失败: ' + error.message);
        }
    }

    /**
     * 更新全局 UI 状态
     */
    updateUI() {
        if (this.elements.studentCount) {
            this.elements.studentCount.textContent = this.state.students.length;
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '正在处理...') {
        if (this.loadingElement) {
            this.loadingElement.remove();
        }

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

function initializeApp() {
    if (typeof document === 'undefined') return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            app = new RollCallApp();
            if (typeof window !== 'undefined') window.app = app;
        });
    } else {
        app = new RollCallApp();
        if (typeof window !== 'undefined') window.app = app;
    }
}

initializeApp();
