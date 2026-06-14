# Repository Guidelines

## 项目结构与模块组织

本仓库是纯静态前端项目，无后端与构建步骤。入口文件为 `index.html`，页面样式集中在 `css/style.css`，业务脚本位于 `js/`：

- `js/app.js`：页面交互、弹窗、通知与事件绑定。
- `js/algorithm.js`：公平点名算法与统计更新逻辑。
- `js/storage.js`：LocalStorage 数据读写、备份与恢复。
- `js/excel.js`：Excel 导入导出相关工具。

当前没有独立的 `tests/` 目录；新增测试时建议放在 `tests/`，并按模块命名，例如 `algorithm.test.js`。

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

目前没有 `npm test`、`npm run build` 或打包配置。提交前至少在 Chrome 或 Edge 中完成主要流程验证。

## 部署说明

项目已从 GitHub Pages 迁移到 Cloudflare Pages。当前线上访问地址为 `https://rc.byhooi.tk`，自定义域名在 Cloudflare Pages 控制台中绑定和管理。

Cloudflare Pages 按静态站点部署：框架预设为无，构建命令留空，发布目录指向仓库根目录（包含 `index.html` 的目录），无需环境变量。

仓库中的 `CNAME` 文件是迁移前 GitHub Pages 使用的域名记录，不参与 Cloudflare Pages 的域名配置。后续修改部署说明时，请同步更新 `README.md` 与 `CLAUDE.md`。

## 编码风格与命名约定

JavaScript 与 CSS 使用 4 空格缩进。JavaScript 类名使用 `PascalCase`，变量、函数与方法使用 `camelCase`，常量或配置应集中定义，避免散落魔法值。CSS 继续沿用 `:root` 变量管理颜色、间距与字体，新增样式优先复用已有设计令牌。不要引入构建工具、框架或大型依赖，除非变更本身确实需要。

## 测试指南

当前以手动回归为主。修改前端逻辑后，请验证：

- 学生名单导入、手动新增、删除与重复校验。
- 点名按钮与空格快捷键。
- 统计更新、重置周期、Excel/JSON 导出。
- 刷新页面后的 LocalStorage 持久化。
- 桌面端与移动端布局。

新增自动化测试时，优先覆盖 `algorithm.js` 和 `storage.js` 的纯逻辑。

## 提交与 Pull Request 规范

历史提交混合使用中文说明与 Conventional Commits 前缀，例如 `fix: 修复...`、`feat: ...`、`docs: ...`、`perf: ...`。建议继续采用 `type: 简短描述`，描述保持具体。

PR 应包含变更目的、主要改动、验证步骤；涉及界面变化时附截图或录屏。若修改存储结构、导入导出格式或点名算法，请明确兼容性影响与回滚方式。

## Agent 专用说明

对话与文档默认使用中文。编辑时保持变更聚焦，不重写无关文件；遇到编码异常或既有用户改动，先确认上下文再处理。
