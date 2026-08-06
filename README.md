# MD Code

基于 md-editor-v3 的 Markdown 能力与交互设计思路，按 Vue 3 单文件组件重新组织的桌面 Markdown IDE 前端内核。

## 当前进度：Phase 2

已实现： 

- Vue 3 + TypeScript + Vite + Pinia 工程骨架
- 全部界面组件使用 `<script setup lang="ts">`，无 JSX/TSX、React 组件或 React Hooks
- Markdown 编辑、实时预览、撤销重做与快捷格式化
- md-editor-v3 风格的线性 SVG 工具栏图标
- 标题、图片、表格、公式、Mermaid、Emoji 下拉面板
- 编辑区与预览区按滚动比例双向同步
- 默认仅预览阅读模式，可切换左右分栏编辑
- 自动生成稳定标题锚点与 Markdown 目录
- highlight.js 代码高亮、KaTeX 数学公式、Mermaid 图表
- 表格、任务列表、链接与图片 Data URL 插入
- 可扩展 `MarkdownPluginRegistry`
- 明暗主题基础设施

下一阶段：

- Tauri 2 文件系统适配
- 多文档 Tab、最近文件与未保存提示
- 异常关闭自动恢复
- 桌面菜单与全局快捷键

## 运行

```bash
npm install
npm run dev
```

## 构建验证

```bash
npm run typecheck
npm run build
```

## Windows 安装器

项目使用 Tauri 2 自带的 NSIS 安装器，不再维护独立的自定义安装程序。安装器使用
简体中文并按当前用户安装，文件关联等 Windows 安装钩子继续由
`src-tauri/windows/nsis-hooks.nsh` 提供。

生成正式安装器：

```bash
npm run tauri:build
```

安装包由 Tauri 输出到 `src-tauri/target/release/bundle/nsis/`。构建脚本会以
`package.json` 的版本为准，同时生成：

- `MDCode_<版本>_x64-setup.exe`
- `MDCode_<版本>_x64-setup.exe.sig`
- `latest.json`

## 自动更新与 GitHub 发版

应用启动后会在后台直接读取下面的 GitHub Release 静态文件，不调用
`api.github.com`：

```text
https://github.com/daidaibg/md-code/releases/latest/download/latest.json
```

没有新版本或查询失败时不会显示任何提示。发现新版本后会在顶部菜单右侧自动显示
下载进度，下载完成后显示“立即更新”。点击更新时会先处理未保存文件，然后静默安装
并重启到新版本。

首次使用前安装并登录 GitHub CLI：

```bash
gh auth login
```

确认 `package.json` 中的版本正确后，一条命令完成构建、签名、生成 `latest.json`
以及创建 GitHub Release：

```bash
npm run release:github
```

更新签名私钥位于本机的 `src-tauri/updater.key`，已经被 Git 忽略。必须单独安全备份，
不能提交或公开；如果丢失，已经安装的旧版本将无法验证以后发布的更新。
构建脚本会安全读取该文件并通过 `TAURI_SIGNING_PRIVATE_KEY` 传给 Tauri；CI 环境也可以
直接设置同名环境变量，而不在工作区创建私钥文件。

## 应用数据目录

Windows 正式版把 WebView2 缓存、Local Storage 和日志保存在安装目录的 `data/` 下，
应用内更新和重新安装不会覆盖该目录。首次运行此版本时，会在 WebView 创建前把旧的
`%LOCALAPPDATA%/com.mdcode.desktop` 数据迁移到安装目录；只有迁移完整成功后才删除
旧数据，失败时继续使用旧目录以保护设置和未保存文档恢复内容。

WebView2 的网页、JavaScript 字节码和 GPU 缓存属于可再生成数据。应用启动时会在
这些缓存合计超过 128 MB 后自动清理，也可以在“设置 → 文件 → 存储与缓存”中手动
安排下次启动清理；Local Storage、IndexedDB、应用设置和用户文档不会被删除。

开发版使用 `src-tauri/.dev-data/`，不会迁移或占用正式版的数据目录。执行 `npm run tauri:dev` 前会自动检查
`target/debug`：超过 6 GB 时使用 Cargo 官方的 Dev Profile 清理命令回收空间；
`target/release` 和正式打包缓存不会受到影响。

`.fingerprint`、`build`、`deps`、`.pdb` 等内容只是 Cargo 编译缓存，不是需要发布的文件。
Cargo 缓存保存在 `src-tauri/target` 中，不会提交到 Git，也不会在打包后自动删除。
缓存会加速后续编译；第一次构建或手动清理后仍需要完整编译一次。

需要手动释放 Cargo 缓存空间时执行：

```bash
npm run clean:cargo:dev
npm run clean:cargo
```

前者仅清理 Debug 编译缓存并保留开发数据及 Release 缓存；后者完整清理整个 Cargo
`target`，下一次开发和正式打包都需要重新编译。

## 分层

```text
Application (src/app)
  -> Editor Store / future Document Manager (src/store, src/document)
    -> Markdown Editor (src/editor)
      -> Markdown Core + Plugin Registry (src/markdown)
```
