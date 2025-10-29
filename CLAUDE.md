# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个网页版班级随机点名系统，采用纯前端实现，具有公平随机点名、数据统计、Excel导入导出等功能。所有数据存储在浏览器的LocalStorage中，无需后端服务器。适用于各类教学场景。

## 快速开始

### 运行项目
```bash
# 方式1：直接双击打开 index.html（推荐）
# 方式2：使用本地服务器
python -m http.server 8000  # 然后访问 http://localhost:8000
```

### 核心依赖
- **SheetJS (xlsx.js)**: 通过CDN引入 `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`
- 无其他外部依赖，纯原生JavaScript实现

## 项目架构

### 文件结构
```
Roll Call/
├── index.html           # 主页面（包含内联样式和结构）
├── css/
│   └── style.css       # 全局样式
└── js/
    ├── app.js          # UI交互层（RollCallApp + NotificationSystem）
    ├── storage.js      # 数据持久层（StorageManager）
    ├── algorithm.js    # 业务逻辑层（RollCallAlgorithm）
    └── excel.js        # 工具层（ExcelManager）
```

### 模块职责

**app.js (UI层)**
- `RollCallApp`: 主应用类，管理所有UI交互和页面状态
- `NotificationSystem`: Toast通知系统，提供 `success/error/info` 三种提示
- 关键方法：
  - `handleRollCall()` - 执行点名操作
  - `handleImportExcel(file)` - 处理Excel导入（含数据验证和回滚）
  - `updateUI()` / `updateCurrentTab()` - 刷新界面显示

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
  - `previewNextCall()` - ��览下次可能被点到的学生集合（用于调试）
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
            updateUI() ← 读取最新数据
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
// app.js:189-239
实时验证学生姓名和座位号：
- 姓名：至少2个字符，边框绿色表示有效，黄色表示警告
- 座位号：必须>0，输入0时显示黄色警告
- 失焦时显示NotificationSystem提示
```

## 常见操作场景

### 添加新功能时的修改顺序
1. **修改数据结构**：在 `storage.js` 的 `createDefaultData()` 中添加新字段
2. **实现业务逻辑**：在 `algorithm.js` 或新文件中实现核心算法
3. **添加UI交互**：在 `app.js` 中添加事件监听器和处理函数
4. **更新界面显示**：修改 `updateUI()` 或相关的 `update*Tab()` 方法

### 调试数据问题
```javascript
// 在浏览器控制台执行：
storage.getAllData()              // 查看完整数据
storage.getBackupInfo()           // 查看备份状态
storage.restoreAutoBackup()       // 恢复备份
algorithm.previewNextCall()       // 预览下次可能点到的学生
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
6. **删除确认**：使用原生 `confirm()` 对话框，无法自定义样式
