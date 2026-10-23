# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供项目说明。

## 项目概述

这是一个网页版班级随机点名系统，采用纯前端实现，具有公平随机点名、数据统计、Excel导入导出等功能。所有数据存储在浏览器的LocalStorage中，无需后端服务器。适用于各类教学场景。

## 开发环境

**这是一个纯静态前端项目，无需构建或编译。**

自动化回归测试使用 Node.js 内置运行器，无需安装任何依赖：

```bash
npm test                                                # 等价于下一条
node --test --test-timeout=20000 tests/*.test.cjs        # 运行全部测试
```

> 注意：`node --test tests/`（传目录）在部分 Node 版本上会报错，请使用上面的 glob 写法。

测试文件说明：

- `tests/core.test.cjs`：公平点名、1000 条历史上限、存储失败一致性、快捷键防重入。
- `tests/features.test.cjs`：编辑学生、多人点名、示例名单。
- `tests/ui-errors.test.cjs`：导入确认流程、点名状态机、ARIA 忙碌标记、按需渲染。
- `tests/excel-loader.test.cjs`：xlsx 按需加载、加载失败重试、导入校验分级。
- `tests/animation.test.cjs`：滚动动画节点复用、减少动效、粒子批量插入。

`tests/manual/browser-check.cjs` 是可选的真实浏览器冒烟脚本（使用本机 Edge/Chrome 的无头模式 + DevTools 协议），需要先启动静态服务器再运行：

```bash
python -m http.server 8123
node tests/manual/browser-check.cjs
```

脚本会自动探测各平台的 Edge/Chrome 常见安装位置，也可用 `EDGE_PATH` 指定浏览器可执行文件，用 `CHECK_URL` 指定被测地址。

### 前端性能约定

- **xlsx 不在首屏加载**：`excel.js` 的 `ensureXlsx()` 在真正导入/导出时才注入 CDN 脚本，新增 Excel 相关方法时必须先 `await ensureXlsx()`。
- **列表渲染不使用 innerHTML 拼接**：管理表格、统计卡片、点名流水、分布条均使用 `createElement` + `DocumentFragment` + `replaceChildren`，文本一律走 `textContent`。
- **点名滚动动画复用节点**：`startRollingAnimation()` 只创建一次骨架，之后仅更新 `textContent`，并用 `requestAnimationFrame` 按时间驱动。
- **隐藏标签页惰性渲染**：数据变更统一走 `refreshUI()`，非当前标签页只标记 `state.dirtyTabs`，切回时再渲染。
- **尊重减少动效**：`prefersReducedMotion()` 为真时跳过滚动帧与粒子特效；CSS 侧在 `@media (prefers-reduced-motion: reduce)` 中兜底。

### 数据一致性约定

- 点名通过 `saveAllData()` 一次提交学生次数、历史与总次数，成功后返回更新后的学生；失败时抛出错误，界面不显示成功结果。
- 历史最多保留 1000 条；累计总次数使用 `getTotalCalls()`，不再直接使用历史长度。旧数据参考学生次数校正，已删除学生的截断历史无法还原。
- 重置周期通过一次 `saveStudents()` 同时重置次数、历史和统计。
- 缓存加载、保存成功和失败重载时同步索引；备份签名仅比较数据，不包含备份时间。
- 本轮不改变存储结构；回滚代码无需转换数据，但旧版仍有统计上限问题。

### 运行项目
```bash
# 方式1：直接双击打开 index.html（推荐）
# 方式2：使用本地服务器
python -m http.server 8000  # 然后访问 http://localhost:8000
```

### 部署环境

项目当前托管在 GitHub Pages，线上访问地址为 `https://dm.468024.xyz`。

部署说明：

- 站点类型：纯静态前端，无需项目构建步骤或环境变量
- 站点文件：位于仓库根目录，入口为 `index.html`
- 自定义域名：`dm.468024.xyz`，与仓库根目录的 `CNAME` 文件保持一致

后续修改域名或部署方式时，请同步更新 `CNAME` 及 `README.md`、`CLAUDE.md`、`AGENTS.md` 中的相关说明。

### 浏览器兼容性
- Chrome 90+（推荐）
- Edge 90+
- Firefox 88+
- Safari 14+
- 移动端浏览器（iOS Safari、Chrome Mobile）

**注意事项**：
- 浏览器隐私模式（无痕浏览）下，LocalStorage 会在关闭标签时清空
- 多标签页同时操作可能导致数据不一致，建议仅在一个标签页使用
- LocalStorage 容量限制通常为 5-10MB

### 核心依赖
- **SheetJS (xlsx.js)**: 通过 CDN 引入 `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`，**首屏不加载**，由 `excel.js` 的 `ensureXlsx()` 在首次导入/导出时按需注入
- 无其他外部依赖，纯原生 JavaScript 实现；字体使用系统字体栈，不再请求 Google Fonts

## 项目架构

### 文件结构
```
Roll Call/
├── index.html           # 主页面结构（无内联样式，脚本使用 defer）
├── package.json         # 仅提供 npm test / npm run serve，无依赖、无构建
├── css/
│   └── style.css       # 全局样式（设计令牌、主题、响应式、减少动效）
├── js/
│   ├── app.js          # UI交互层（RollCallApp + NotificationSystem + DialogService）
│   ├── storage.js      # 数据持久层（StorageManager）
│   ├── algorithm.js    # 业务逻辑层（RollCallAlgorithm）
│   └── excel.js        # 工具层（ExcelManager + ensureXlsx 按需加载）
└── tests/
    ├── *.test.cjs      # node --test 自动化回归
    └── manual/browser-check.cjs  # 可选的无头浏览器冒烟脚本
```

### 模块职责

**app.js (UI层)**
- `RollCallApp`: 主应用类，管理所有UI交互和页面状态
- `NotificationSystem`: Toast通知系统，提供 `success/error/info` 三种提示，并同步写入 ARIA live 区域
- `DialogService`: 自定义确认弹窗（替代原生 `confirm()`），带焦点陷阱与焦点还原
- 关键方法：
  - `handleRollCall()` - 执行点名操作
  - `startRollingAnimation(count, callback)` - 滚动动画，复用节点 + `requestAnimationFrame`
  - `handleImportExcel(file)` - 处理Excel导入（含数据验证和回滚）
  - `refreshUI()` - 数据变更后的统一刷新入口（隐藏标签页惰性渲染）
  - `switchTab()` / `updateCurrentTab()` - 标签页切换与刷新

**storage.js (数据层)**
- `StorageManager`: 封装LocalStorage操作，提供索引优化和自动备份
- 全局单例：`storage`
- 关键特性：
  - 内存索引：`studentIndex` (按ID)、`seatIndex` (按座位号)，加速查找
  - 自动备份：默认每5分钟备份一次到 `roll-call-backup` key
  - 配额处理：存储空间不足时自动清理备份并禁用自动备份
  - ID生成：`generateUniqueId()` 使用时间戳+随机数+计数器组合，避免冲突
- 关键方法：
  - `getStudents()` / `saveStudents(students)` - 学生数据管理
  - `enableAutoBackup(intervalMinutes)` / `disableAutoBackup()` - 备份控制
  - `restoreAutoBackup()` - 恢复备份数据
  - `updateIndexes(students)` - 重建内存索引（修改学生数据后必须调用）

**algorithm.js (算法层)**
- `RollCallAlgorithm`: 实现公平随机点名算法
- 全局单例：`algorithm`
- 核心算法：
  1. `getLeastCalledGroup()` - 找出被点名次数最少的学生群组
  2. `getRandomStudentFromGroup()` - 从群组中随机选一个
  3. `rollCall()` - 执行点名并更新学生的 `callCount` 和 `lastCall`
- 关键方法：
  - `previewNextCall()` - 预览下次可能被点到的学生集合（用于调试）
  - `getStudentStats()` - 返回完整统计信息（总次数、平均次数、分布等）
  - `resetAllCallCounts()` - 重置统计周期（清空callCount、历史记录和stats）

**excel.js (工具层)**
- `ExcelManager`: 处理Excel文件的导入导出
- 全局单例：`excel`
- 导入特性：
  - 使用UTF-8编码处理中文字符（`codepage: 65001`）
  - 表头识别：自动查找包含"姓名"和"座位"的列
  - 数据验证：`validateStudentData()` 检查重复座位号、重复姓名、姓名长度、座位号合理性
  - 导入失败时支持数据回滚（在 `app.js:handleImportExcel()` 中实现）
- 导出功能：
  - `exportStudentsToExcel()` - 导出学生名单（含被点次数和最后点名时间）
  - `exportStatisticsToExcel()` - 导出统计报表（包含汇总信息和详情两个工作表）

### 数据流向
```
用户操作 → RollCallApp → algorithm/storage/excel → LocalStorage
                ↓
            refreshUI() → loadInitialData() + 仅刷新当前标签页
```

### 全局实例
代码中创建了4个全局单例对象，在不同模块间共享：
```javascript
window.app = new RollCallApp()        // app.js 末尾初始化
const storage = new StorageManager()   // storage.js:473
const algorithm = new RollCallAlgorithm()  // algorithm.js:152
const excel = new ExcelManager()       // excel.js:388
```

## 核心数据结构

### LocalStorage存储格式（key: `roll-call-data`）
```javascript
{
  students: [
    {
      id: "lx1y2z3abc456def",  // 36进制时间戳+随机数+计数器
      name: "张三",
      seat: 1,
      callCount: 5,              // 本周期被点名次数
      lastCall: "2025-01-15T10:30:00.000Z"  // ISO格式时间戳
    }
  ],
  callHistory: [
    {
      id: "lx1y2z3ghi789jkl",
      studentId: "lx1y2z3abc456def",
      studentName: "张三",
      studentSeat: 1,
      timestamp: "2025-01-15T10:30:00.000Z",
      date: "2025/1/15"
    }
    // 最多保留1000条历史记录（storage.js:331）
  ],
  stats: {
    cycleStart: "2025-01-01",  // 统计周期开始日期
    totalCalls: 100            // 本周期总点名次数
  }
}
```

### 备份数据格式（key: `roll-call-backup`）
```javascript
{
  data: { /* 完整的 roll-call-data 数据 */ },
  timestamp: "2025-01-15T10:30:00.000Z",
  version: "1.0"
}
```

## 关键实现细节

### 公平随机算法原理
```javascript
// algorithm.js:38-54
1. 获取所有学生的 callCount
2. 找出 callCount 最小的学生群组（可能多人）
3. 从该群组中随机选一个
4. 更新该学生的 callCount++，lastCall=当前时间
5. 添加历史记录到 callHistory
```

### Excel导入流程
```javascript
// excel.js:16-129 + app.js:336-380
1. 读取Excel文件为ArrayBuffer
2. 使用XLSX.read()解析（codepage=65001处理中文）
3. 查找"姓名""座位"列的索引
4. 逐行解析数据，生成student对象（带新ID）
5. 调用validateStudentData()检查数据质量
6. 如果有错误/警告，弹出确认框让用户选择是否继续
7. 用户取消 → 恢复导入前的学生列表快照
8. 用户确认 → saveStudents()写入LocalStorage
```

### 快捷键支持
- **空格键**: 在点名页面触发点名（app.js:126-131）
- **ESC键**: 关闭添加学生弹窗（app.js:171-175）

### 索引优化机制
```javascript
// storage.js:379-387
StorageManager维护两个Map索引：
- studentIndex: Map<id, student>  // 按ID快速查找
- seatIndex: Map<seat, student>   // 按座位号快速查找

每次修改students数组后必须调用updateIndexes()重建索引：
- addStudent() ✓
- updateStudent() ✓
- deleteStudent() ✓
- saveStudents() ✓
```

### 自动备份机制
```javascript
// storage.js:33-106
- 初始化时自动启动：storage.enableAutoBackup() (storage.js:475)
- 默认每5分钟创建备份到localStorage的 roll-call-backup key
- 存储空间不足时自动禁用备份并清理旧备份
- 备份包含完整的students、callHistory、stats数据
```

### 表单验证
```javascript
// app.js:setupFormValidation()
实时验证学生姓名和座位号：
- 姓名：至少2个字符，有效时加 .field-valid，过短时加 .field-warning
- 座位号：必须>0，输入0时加 .field-warning
- 状态通过 class 与 aria-invalid 表达，样式在 css/style.css 的 .field-valid / .field-warning 中统一维护
```

## 常见操作场景

### 添加新功能时的修改顺序
1. **修改数据结构**：在 `storage.js` 的 `createDefaultData()` 中添加新字段
2. **实现业务逻辑**：在 `algorithm.js` 或新文件中实现核心算法
3. **添加UI交互**：在 `app.js` 中添加事件监听器和处理函数
4. **更新界面显示**：修改 `updateUI()` 或相关的 `update*Tab()` 方法

### 调试数据问题
在浏览器开发者工具的控制台中执行以下命令：

**查看数据**：
```javascript
storage.getAllData()              // 查看完整数据（students、callHistory、stats）
storage.getStudents()             // 仅查看学生列表
storage.getCallHistory()          // 仅查看点名历史记录
storage.getStats()                // 仅查看统计信息
algorithm.getStudentStats()       // 查看详细统计（含平均次数、分布等）
```

**预览和调试**：
```javascript
algorithm.previewNextCall()       // 预览下次可能被点到的学生集合
storage.studentIndex              // 查看按ID索引的学生Map
storage.seatIndex                 // 查看按座位号索引的学生Map
```

**备份和恢复**：
```javascript
storage.getBackupInfo()           // 查看备份状态和时间戳
storage.restoreAutoBackup()       // 从自动备份恢复数据
storage.createAutoBackup()        // 立即创建一次自动备份（有变化才写）
storage.disableAutoBackup()       // 禁用自动备份
storage.enableAutoBackup(5)       // 启用自动备份（间隔5分钟）
```

**数据操作**：
```javascript
// 修改学生数据后必须调用以重建索引
storage.updateIndexes(storage.getStudents())

// 重置统计周期（清空所有点名次数和历史记录）
algorithm.resetAllCallCounts()
```

### 修改点名算法
算法核心在 `algorithm.js:13-32`，修改时注意：
1. `getLeastCalledGroup()` 决定候选集合
2. `getRandomStudentFromGroup()` 决定随机策略
3. 修改后必须同步更新 `rollCall()` 中的记录逻辑

### 处理Excel兼容性问题
中文编码问题在 `excel.js:26-32` 配置：
```javascript
XLSX.read(data, {
  type: 'array',
  codepage: 65001,  // UTF-8，处理中文必需
  cellNF: false,    // 禁用数字格式化
  cellHTML: false,  // 禁用HTML
  cellFormula: false // 禁用公式
})
```

## 已知限制与注意事项

1. **数据容量限制**：LocalStorage通常限制5-10MB，存储超过1000条历史记录可能接近上限
2. **并发冲突**：多标签页同时操作可能导致数据不一致（无跨标签同步机制）
3. **备份覆盖**：自动备份只保留最新一份，无历史版本
4. **浏览器隐私模式**：无痕浏览模式下LocalStorage关闭标签即清空
5. **Excel表头识别**：依赖 `toLowerCase().includes('姓名')` 和 `includes('座位')` 匹配，表头必须包含这些关键字
6. **删除确认**：使用 `DialogService.confirm()` 自定义弹窗（已不再是原生 `confirm()`），支持 Escape 取消、Enter 确认、Tab 焦点陷阱
