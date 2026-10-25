# Repository Guidelines

## 项目结构与模块组织

本仓库是纯静态前端项目，无后端与构建步骤。入口文件为 `index.html`，页面样式集中在 `css/style.css`，业务脚本位于 `js/`：

- `js/app.js`：页面交互、弹窗、通知与事件绑定。
- `js/algorithm.js`：公平点名算法与统计更新逻辑。
- `js/storage.js`：LocalStorage 数据读写、备份与恢复。
- `js/excel.js`：Excel 导入导出相关工具（含 xlsx 按需加载）。

测试位于 `tests/`，按模块命名并使用 `.cjs` 后缀，例如 `algorithm.test.cjs`。

## 构建、测试与本地开发命令

项目可直接在浏览器中运行：

```bash
# 直接打开 index.html，适合快速验证
```

如需模拟站点访问或避免浏览器本地文件限制，使用静态服务器：

```bash
python -m http.server 8000
# 访问 http://localhost:8000
```

目前没有构建流程或打包配置。自动化测试无需安装依赖：

```bash
npm test
# 等价于 node --test --test-timeout=20000 tests/*.test.cjs
```

提交前至少在 Chrome 或 Edge 中完成主要流程验证。可选的真浏览器冒烟脚本：先启动静态服务器，再运行 `node tests/manual/browser-check.cjs`（自动探测本机 Edge/Chrome，可用 `EDGE_PATH` 覆盖）。

## 部署说明

项目当前托管在 GitHub Pages，线上访问地址为 `https://dm.468024.xyz`。

项目为纯静态前端，无需项目构建步骤或环境变量。站点文件位于仓库根目录，入口为 `index.html`。

自定义域名为 `dm.468024.xyz`，与仓库根目录的 `CNAME` 文件保持一致。后续修改域名或部署方式时，请同步更新 `CNAME` 及 `README.md`、`CLAUDE.md`、`AGENTS.md` 中的相关说明。

## 编码风格与命名约定

JavaScript 与 CSS 使用 4 空格缩进。JavaScript 类名使用 `PascalCase`，变量、函数与方法使用 `camelCase`，常量或配置应集中定义，避免散落魔法值。CSS 继续沿用 `:root` 变量管理颜色、间距与字体，新增样式优先复用已有设计令牌。不要引入构建工具、框架或大型依赖，除非变更本身确实需要。

视觉约定（学院工具风）：默认主题为浅色纸面，`body.dark-theme` 为深色主题，两者共用 `:root` 中的同一套令牌；朱红（`--accent`）只用于「点名」这一主操作与当前导航项，不要扩散到普通数据。图标使用内联 SVG（24 网格、1.5 描边、`currentColor`），不要用 emoji 充当图标。不引入毛玻璃、发光与全屏动态背景，投影对比度优先。

深色主题的令牌不是浅色值的机械取反，改色时守住三条线：正文墨字 ≥ 13:1，次级（`--ink-2`）≥ 8:1，注释级（`--ink-3`）≥ 5.5:1；分隔线（`--line`）必须比底色明显亮一档，否则暗底细线整片消失。实心填充块用 `--accent-solid` / `--danger-solid` / `--warning-solid` 与 `--on-solid` 成对取色——亮红配白字在暗底会发虚，深色主题里填充色要压深一档再放白字。浅色主题的注释级（`--ink-3`）同样要 ≥ 4.5:1，导航、表头、说明文字全在这一级。

长表格三件套不要拆开改：`.app-header` 吸顶、`.table-card` 用 `calc(100dvh - 120px)` 限高、表格 `border-collapse: separate`（`collapse` 会让 `th` 的 `sticky` 在 Chrome 失效）。名册与统计的版心限制在 960px 并居中，5 个短字段铺满整屏会把一行拉成两次扫视；`min-width: 769px` 起用 `table-layout: fixed`，只让「操作」列吸收剩余宽度。危险操作（清空、删除、重置周期）常态用中性色，红色只在悬停与确认框里出现。

## 测试指南

当前以自动化测试配合手动回归。修改前端逻辑后，请验证：

- 学生名单导入、手动新增、删除与重复校验。
- 点名按钮与空格快捷键。
- 统计更新、重置周期、Excel/JSON 导出。
- 刷新页面后的 LocalStorage 持久化。
- 桌面端与移动端布局。

新增自动化测试时，优先覆盖 `algorithm.js` 和 `storage.js` 的纯逻辑，其次覆盖 `excel.js` 的校验与按需加载，以及 `app.js` 的渲染与状态机。

## 前端性能约定

- xlsx 必须通过 `excel.js` 的 `ensureXlsx()` 按需加载，不得重新放回首屏同步脚本。
- 列表渲染使用 `createElement` + `DocumentFragment` + `replaceChildren`，不要拼接 `innerHTML`。
- 点名滚动动画只创建一次节点，之后更新 `textContent`，禁止每帧重建 DOM。
- 数据变更统一调用 `refreshUI()`，隐藏标签页只标记 `state.dirtyTabs`。
- 新动画需同时考虑 `prefers-reduced-motion`，JS 与 CSS 两侧都要有兜底。

## 提交与 Pull Request 规范

历史提交混合使用中文说明与 Conventional Commits 前缀，例如 `fix: 修复...`、`feat: ...`、`docs: ...`、`perf: ...`。建议继续采用 `type: 简短描述`，描述保持具体。

PR 应包含变更目的、主要改动、验证步骤；涉及界面变化时附截图或录屏。若修改存储结构、导入导出格式或点名算法，请明确兼容性影响与回滚方式。

## Agent 专用说明

对话与文档默认使用中文。编辑时保持变更聚焦，不重写无关文件；遇到编码异常或既有用户改动，先确认上下文再处理。
