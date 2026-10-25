/**
 * 简单的通知系统
 */
class NotificationSystem {
    /** @type {HTMLElement|null} 读屏软件播报区域 */
    static liveRegion = null;

    /**
     * 获取（必要时创建）ARIA live 容器，避免每条 toast 各自播报
     */
    static getLiveRegion() {
        if (typeof document === 'undefined') return null;
        if (this.liveRegion && this.liveRegion.isConnected) {
            return this.liveRegion;
        }
        const region = document.createElement('div');
        region.className = 'visually-hidden';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        document.body.appendChild(region);
        this.liveRegion = region;
        return region;
    }

    static show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 错误信息用 assertive 立即播报，其余保持 polite 以免打断
        const region = this.getLiveRegion();
        if (region) {
            region.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
            region.textContent = message;
        }

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
            // 记录打开前的焦点，关闭后还原，避免键盘用户丢失位置
            const previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null;

            const overlay = document.createElement('div');
            overlay.className = 'modal active confirm-modal';
            overlay.dataset.type = type;

            const content = document.createElement('div');
            content.className = 'modal-content confirm-content';
            content.setAttribute('role', 'alertdialog');
            content.setAttribute('aria-modal', 'true');

            const titleId = 'confirm-title-' + Math.random().toString(36).slice(2);
            const descId = 'confirm-desc-' + Math.random().toString(36).slice(2);
            content.setAttribute('aria-labelledby', titleId);
            content.setAttribute('aria-describedby', descId);

            const titleElement = document.createElement('h3');
            titleElement.id = titleId;
            titleElement.textContent = title;

            const messageContainer = document.createElement('div');
            messageContainer.className = 'confirm-message';
            messageContainer.id = descId;
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
                document.removeEventListener('keydown', handleKeyDown, true);
                overlay.remove();
                if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                    previouslyFocused.focus();
                }
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
                    event.preventDefault();
                    handleCancel();
                    return;
                }
                if (event.key === 'Enter') {
                    event.preventDefault();
                    handleConfirm();
                    return;
                }
                // 焦点陷阱：Tab 只在弹窗内循环
                if (event.key === 'Tab') {
                    const focusables = [cancelButton, confirmButton];
                    const current = focusables.indexOf(document.activeElement);
                    event.preventDefault();
                    const next = event.shiftKey
                        ? focusables[(current <= 0 ? focusables.length : current) - 1]
                        : focusables[(current + 1) % focusables.length];
                    next.focus();
                }
            };

            cancelButton.addEventListener('click', handleCancel);
            confirmButton.addEventListener('click', handleConfirm);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    handleCancel();
                }
            });
            document.addEventListener('keydown', handleKeyDown, true);

            requestAnimationFrame(() => {
                confirmButton.focus();
            });
        });
    }

    /**
     * 转义 HTML 特殊字符。
     * 注意：列表渲染已改为 DOM 节点 + textContent，此方法仅用于确需拼接 HTML 的场景。
     */
    static escapeHtml(text = '') {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
            statsView: 'cards', // 'cards' 或 'history'
            // 隐藏的标签页不立即渲染，切回时再刷新
            dirtyTabs: new Set(['students', 'statistics'])
        };

        this.init();
    }

    /**
     * 用户是否开启了“减少动态效果”
     */
    prefersReducedMotion() {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        // 默认（无类名）为浅色纸面主题；dark-theme 为夜间主题
        const isDark = document.body.classList.toggle('dark-theme');
        try {
            localStorage.setItem('roll-call-theme', isDark ? 'dark' : 'light');
        } catch (e) {}
        NotificationSystem.info(isDark ? '已切换至深色主题' : '已切换至浅色主题');
    }

    /**
     * 恢复已保存的主题
     */
    restoreTheme() {
        try {
            const savedTheme = localStorage.getItem('roll-call-theme');
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-theme');
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
     * 设置表单验证和实时反馈。
     * 用 class 表达状态，主题切换与高对比度模式可直接覆盖样式。
     */
    setupFormValidation() {
        const nameInput = document.getElementById('student-name');
        const seatInput = document.getElementById('student-seat');
        if (!nameInput || !seatInput) return;

        const setFieldState = (input, state, hint) => {
            input.classList.toggle('field-valid', state === 'valid');
            input.classList.toggle('field-warning', state === 'warning');
            if (state === 'warning') {
                input.title = hint;
                input.setAttribute('aria-invalid', 'true');
                input.setCustomValidity(hint);
            } else {
                input.title = '';
                input.removeAttribute('aria-invalid');
                input.setCustomValidity('');
            }
        };

        nameInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value.length > 0 && value.length < 2) {
                setFieldState(e.target, 'warning', '姓名至少需要2个字符');
            } else if (value.length >= 2) {
                setFieldState(e.target, 'valid');
            } else {
                setFieldState(e.target, 'none');
            }
        });

        seatInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            if (value && value > 0) {
                setFieldState(e.target, 'valid');
            } else if (value === 0) {
                setFieldState(e.target, 'warning', '座位号必须大于0');
            } else {
                setFieldState(e.target, 'none');
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
     * 更新当前标签页（仅渲染可见的标签页）
     */
    updateCurrentTab() {
        const tab = this.state.activeTab;
        if (tab === 'students') {
            this.updateStudentsTab();
        } else if (tab === 'statistics') {
            this.updateStatisticsTab();
        }
        if (this.state.dirtyTabs) {
            this.state.dirtyTabs.delete(tab);
        }
    }

    /**
     * 数据变更后刷新界面。
     * 隐藏的标签页不立即重建 DOM，只做标记，切回时再渲染，
     * 避免每次点名都为看不见的表格与卡片付出解析与排版成本。
     */
    refreshUI() {
        this.loadInitialData();
        this.updateUI();

        const active = this.state.activeTab;
        if (active === 'students' || active === 'statistics') {
            this.updateCurrentTab();
        } else {
            if (this.state.dirtyTabs) {
                this.state.dirtyTabs.add('students').add('statistics');
            }
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
        this.elements.rollBtn.setAttribute('aria-busy', 'true');
        this.setRollStatus('点名进行中...', 'rolling');

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
                    // 选中结果已由 algorithm 返回，界面刷新交给 refreshUI 统一处理
                    this.refreshUI();
                    this.showSelectedStudents(count);
                    this.setRollStatus('点名完成', 'completed');

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
                this.setRollStatus('点名失败，请重试', 'failed');
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
     * 更新点名状态徽标，并通过 aria-live 播报给读屏软件
     */
    setRollStatus(text, state) {
        const status = this.elements.rollStatus;
        if (!status) return;
        status.textContent = text;
        status.className = 'status-badge' + (state ? ' ' + state : '');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
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
        btn.removeAttribute('aria-busy');
    }

    /**
     * 开始滚动动画。
     * 使用 requestAnimationFrame + 时间驱动，帧率自适应（120Hz 屏幕更均匀）；
     * 只创建一次节点，之后仅更新 textContent，避免每帧重建 DOM。
     */
    startRollingAnimation(count, callback) {
        const box = this.elements.selectedStudent;
        const students = this.state.students;
        const reducedMotion = this.prefersReducedMotion();
        const tickInterval = 45;
        const duration = reducedMotion
            ? 0
            : Math.max(500, Math.min(950, students.length * 20 + 450));

        // 动画开始前建立骨架节点，后续只改文本
        let nameEl;
        let seatEl;
        let pickerNodes;

        if (count === 1) {
            box.replaceChildren();
            nameEl = document.createElement('div');
            nameEl.className = 'name rolling-text';
            seatEl = document.createElement('div');
            seatEl.className = 'seat rolling-text';
            box.append(nameEl, seatEl);
        } else {
            box.replaceChildren();
            const grid = document.createElement('div');
            grid.className = 'multi-roll-grid';
            pickerNodes = [];
            for (let i = 0; i < count; i++) {
                const card = document.createElement('div');
                card.className = 'multi-student-card';
                const cardSeat = document.createElement('span');
                cardSeat.className = 'card-seat';
                const cardName = document.createElement('span');
                cardName.className = 'card-name';
                card.append(cardSeat, cardName);
                grid.appendChild(card);
                pickerNodes.push({ seat: cardSeat, name: cardName });
            }
            box.appendChild(grid);
        }

        const pickRandom = () => students[Math.floor(Math.random() * students.length)];

        const renderTick = () => {
            if (count === 1) {
                const student = pickRandom();
                if (student) {
                    nameEl.textContent = student.name;
                    seatEl.textContent = '座位号：' + student.seat;
                }
            } else {
                pickerNodes.forEach(node => {
                    const student = pickRandom();
                    if (student) {
                        node.seat.textContent = '座位 ' + student.seat;
                        node.name.textContent = student.name;
                    }
                });
            }
        };

        // 减少动态效果时只渲染一帧，直接进入结果
        if (reducedMotion || duration === 0) {
            renderTick();
            requestAnimationFrame(callback);
            return;
        }

        box.classList.add('rolling-fast');
        box.setAttribute('aria-busy', 'true');

        const startTime = performance.now();
        let lastTickTime = 0;

        const frame = (now) => {
            const elapsed = now - startTime;

            if (elapsed >= duration) {
                box.classList.remove('rolling-fast');
                box.removeAttribute('aria-busy');
                requestAnimationFrame(callback);
                return;
            }

            if (now - lastTickTime >= tickInterval) {
                lastTickTime = now;
                this.sound.playTick();
                renderTick();
            }

            requestAnimationFrame(frame);
        };

        renderTick();
        requestAnimationFrame(frame);
    }

    /**
     * 显示选中的学生（单人/多人）
     */
    showSelectedStudents(count) {
        this.createParticleExplosion();
        const box = this.elements.selectedStudent;
        box.classList.add('flip-in');

        if (count === 1 && this.state.selectedStudent) {
            const student = this.state.selectedStudent;

            const nameEl = document.createElement('div');
            nameEl.className = 'name';
            nameEl.textContent = student.name;

            const seatEl = document.createElement('div');
            seatEl.className = 'seat';
            seatEl.textContent = '座位号：' + student.seat;

            box.replaceChildren(nameEl, seatEl);

            const strong = document.createElement('strong');
            strong.textContent = String(student.callCount);
            this.elements.studentInfo.replaceChildren(
                document.createTextNode('该学生本周期内已被点中 '),
                strong,
                document.createTextNode(' 次')
            );
        } else {
            const list = this.state.selectedMultiple;
            const grid = document.createElement('div');
            grid.className = 'multi-roll-grid';

            list.forEach(student => {
                const card = document.createElement('div');
                card.className = 'multi-student-card flip-in';

                const seat = document.createElement('span');
                seat.className = 'card-seat';
                seat.textContent = '座位号：' + student.seat;

                const name = document.createElement('span');
                name.className = 'card-name';
                name.textContent = student.name;

                const countEl = document.createElement('span');
                countEl.className = 'card-count';
                countEl.textContent = `本周期被点 ${student.callCount || 0} 次`;

                card.append(seat, name, countEl);
                grid.appendChild(card);
            });

            box.replaceChildren(grid);

            const strong = document.createElement('strong');
            strong.textContent = String(list.length);
            this.elements.studentInfo.replaceChildren(
                document.createTextNode('本次共抽选 '),
                strong,
                document.createTextNode(' 名同学回答问题')
            );
        }

        setTimeout(() => {
            box.classList.remove('flip-in');
        }, 650);
    }

    /**
     * 创建粒子爆炸礼花效果。
     * 减少了粒子数量，并用单个定时器统一清理，避免每次点名创建几十个定时器。
     */
    createParticleExplosion() {
        if (this.prefersReducedMotion()) return;

        const resultDisplay = document.querySelector('.roll-display-area');
        if (!resultDisplay) return;
        const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#ffd166', '#ff4757'];
        const particleCount = 22;
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('span');
            particle.className = 'particle';
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];

            const angle = (Math.PI * 2 * i) / particleCount;
            const velocity = 120 + Math.random() * 120;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);

            fragment.appendChild(particle);
        }

        resultDisplay.appendChild(fragment);

        // 一次清理全部粒子，而不是为每个粒子挂一个定时器
        setTimeout(() => {
            resultDisplay.querySelectorAll('.particle').forEach(node => node.remove());
        }, 900);
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

            this.refreshUI();

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
            this.refreshUI();

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
                this.refreshUI();

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
                this.refreshUI();

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
                this.refreshUI();

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
     * 更新学生列表显示（支持搜索与排序）。
     * 使用 DOM 节点 + DocumentFragment 一次性替换，避免字符串拼接与重复转义。
     */
    updateStudentList() {
        const tbody = this.elements.studentsTbody;

        if (this.elements.studentCount) {
            this.elements.studentCount.textContent = this.state.students.length;
        }

        if (!tbody) return;

        if (this.state.students.length === 0) {
            tbody.replaceChildren(this.buildEmptyRow('—', '暂无数据，请先导入或点击上方「示例」体验'));
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
            tbody.replaceChildren(this.buildEmptyRow(null, '未找到匹配的学生'));
            return;
        }

        const fragment = document.createDocumentFragment();

        list.forEach(student => {
            const row = document.createElement('tr');

            const seatCell = document.createElement('td');
            const seatStrong = document.createElement('strong');
            seatStrong.textContent = String(student.seat);
            seatCell.appendChild(seatStrong);

            const nameCell = document.createElement('td');
            nameCell.textContent = student.name;

            const callCell = document.createElement('td');
            const callBadge = document.createElement('span');
            callBadge.className = 'call-badge';
            callBadge.textContent = `${student.callCount || 0} 次`;
            callCell.appendChild(callBadge);

            const timeCell = document.createElement('td');
            const timeSpan = document.createElement('span');
            timeSpan.className = 'time-muted';
            timeSpan.textContent = this.formatShortTime(student.lastCall);
            timeCell.appendChild(timeSpan);

            const opsCell = document.createElement('td');
            opsCell.className = 'table-ops';
            opsCell.append(
                this.buildRowAction('编辑', 'edit-student', student.id, 'btn-sm btn-edit'),
                this.buildRowAction('删除', 'delete-student', student.id, 'btn-sm btn-danger')
            );

            row.append(seatCell, nameCell, callCell, timeCell, opsCell);
            fragment.appendChild(row);
        });

        tbody.replaceChildren(fragment);
    }

    /**
     * 构建表格空状态行
     */
    buildEmptyRow(icon, text) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'empty-state';

        if (icon) {
            const content = document.createElement('div');
            content.className = 'empty-content';
            const iconEl = document.createElement('span');
            iconEl.className = 'empty-icon';
            iconEl.textContent = icon;
            const textEl = document.createElement('p');
            textEl.textContent = text;
            content.append(iconEl, textEl);
            cell.appendChild(content);
        } else {
            cell.textContent = text;
        }

        row.appendChild(cell);
        return row;
    }

    /**
     * 构建行内操作按钮（事件统一由 tbody 委托处理）
     */
    buildRowAction(label, action, id, className) {
        const button = document.createElement('button');
        button.className = className;
        button.dataset.action = action;
        button.dataset.id = id;
        button.textContent = label;
        return button;
    }

    /**
     * 格式化“月-日 时:分”，从未点名时返回占位文案
     */
    formatShortTime(isoString) {
        if (!isoString) return '从未被点';
        return new Date(isoString).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
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
            this.elements.statsViewCards.setAttribute('aria-pressed', String(view === 'cards'));
            this.elements.statsViewHistory.setAttribute('aria-pressed', String(view === 'history'));
        }
        if (this.elements.statsGrid) {
            this.elements.statsGrid.hidden = view !== 'cards';
        }
        if (this.elements.statsHistoryList) {
            this.elements.statsHistoryList.hidden = view !== 'history';
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
        // 人均次数常小于 1（30 人点 1 次 = 0.03），保留一位会显示成 0.0，
        // 等于告诉使用者「这次点名没有发生」，所以小于 1 时保留两位
        if (this.elements.avgCalls) {
            const avg = stats.averageCalls || 0;
            let avgText = '0';
            if (stats.totalCalls > 0) {
                avgText = avg < 1 ? avg.toFixed(2) : avg.toFixed(1);
            }
            this.elements.avgCalls.textContent = avgText;
        }

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
            const bar = this.elements.distributionBar;

            if (entries.length === 0 || stats.totalStudents === 0) {
                const empty = document.createElement('span');
                empty.className = 'empty-subtext';
                empty.textContent = '暂无分布数据';
                bar.replaceChildren(empty);
            } else {
                const fragment = document.createDocumentFragment();

                entries.forEach(([count, num]) => {
                    const chip = document.createElement('div');
                    chip.className = 'distribution-chip';

                    const countEl = document.createElement('span');
                    countEl.className = 'chip-count';
                    countEl.textContent = `${count} 次`;

                    const studentsEl = document.createElement('span');
                    studentsEl.className = 'chip-students';
                    studentsEl.textContent = `${num} 人`;

                    const percentEl = document.createElement('span');
                    percentEl.className = 'chip-percent';
                    percentEl.textContent = `${Math.round((num / stats.totalStudents) * 100)}%`;

                    chip.append(countEl, studentsEl, percentEl);
                    fragment.appendChild(chip);
                });

                bar.replaceChildren(fragment);
            }
        }

        // 卡片列表视图
        const searchInput = document.getElementById('stats-search');
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

        if (this.elements.statsGrid) {
            const statsGrid = this.elements.statsGrid;
            if (stats.totalStudents === 0) {
                statsGrid.replaceChildren(this.buildEmptyState('暂无统计数据'));
            } else {
                // 按被点次数降序：这张网格的任务是「看出谁被点得多」，
                // 而不是把名册原样再列一遍
                let filtered = stats.students
                    .slice()
                    .sort((a, b) => (b.callCount || 0) - (a.callCount || 0)
                        || String(a.seat).localeCompare(String(b.seat), 'zh-Hans-CN', { numeric: true }));
                if (searchTerm) {
                    filtered = filtered.filter(s =>
                        s.name.toLowerCase().includes(searchTerm) ||
                        String(s.seat).includes(searchTerm)
                    );
                }

                if (filtered.length === 0) {
                    statsGrid.replaceChildren(this.buildEmptyState('未找到匹配的学生'));
                } else {
                    const fragment = document.createDocumentFragment();

                    filtered.forEach(student => {
                        const card = document.createElement('div');
                        card.className = 'stat-item-card';
                        if (!student.callCount) {
                            card.classList.add('is-zero');
                        }

                        const header = document.createElement('div');
                        header.className = 'stat-item-header';
                        const seat = document.createElement('div');
                        seat.className = 'stat-seat';
                        seat.textContent = '座位号：' + student.seat;
                        const callCount = document.createElement('span');
                        callCount.className = 'stat-call-count';
                        callCount.textContent = `${student.callCount || 0} 次`;
                        header.append(seat, callCount);

                        const body = document.createElement('div');
                        body.className = 'stat-item-body';
                        const name = document.createElement('div');
                        name.className = 'stat-name';
                        name.textContent = student.name;
                        body.appendChild(name);

                        const footer = document.createElement('div');
                        footer.className = 'stat-item-footer';
                        const lastCall = document.createElement('div');
                        lastCall.className = 'stat-last-call';
                        lastCall.textContent = '最后点名：' + this.formatShortTime(student.lastCall);
                        footer.appendChild(lastCall);

                        card.append(header, body, footer);
                        fragment.appendChild(card);
                    });

                    statsGrid.replaceChildren(fragment);
                }
            }
        }

        // 点名流水表格视图
        if (this.elements.statsHistoryList) {
            const history = this.state.callHistory || [];
            const container = this.elements.statsHistoryList;

            if (history.length === 0) {
                container.replaceChildren(this.buildEmptyState('暂无点名历史流水'));
            } else {
                let filteredHistory = history;
                if (searchTerm) {
                    filteredHistory = history.filter(h =>
                        (h.studentName || '').toLowerCase().includes(searchTerm) ||
                        String(h.studentSeat || '').includes(searchTerm)
                    );
                }

                const table = document.createElement('table');
                table.className = 'history-table';

                const thead = document.createElement('thead');
                const headRow = document.createElement('tr');
                ['序号', '座位号', '姓名', '点名时间'].forEach(label => {
                    const th = document.createElement('th');
                    th.textContent = label;
                    headRow.appendChild(th);
                });
                thead.appendChild(headRow);

                const tbody = document.createElement('tbody');
                const fragment = document.createDocumentFragment();

                filteredHistory.slice(0, 100).forEach((record, idx) => {
                    const row = document.createElement('tr');

                    const indexCell = document.createElement('td');
                    indexCell.textContent = String(idx + 1);

                    const seatCell = document.createElement('td');
                    const seatStrong = document.createElement('strong');
                    seatStrong.textContent = String(record.studentSeat ?? '');
                    seatCell.appendChild(seatStrong);

                    const nameCell = document.createElement('td');
                    nameCell.textContent = record.studentName || '';

                    const timeCell = document.createElement('td');
                    timeCell.textContent = record.timestamp
                        ? new Date(record.timestamp).toLocaleString('zh-CN')
                        : (record.date || '');

                    row.append(indexCell, seatCell, nameCell, timeCell);
                    fragment.appendChild(row);
                });

                tbody.appendChild(fragment);
                table.append(thead, tbody);
                container.replaceChildren(table);
            }
        }
    }

    /**
     * 构建统一的空状态占位节点
     */
    buildEmptyState(text) {
        const el = document.createElement('div');
        el.className = 'empty-state';
        el.textContent = text;
        return el;
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
            this.refreshUI();

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
            this.refreshUI();

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
