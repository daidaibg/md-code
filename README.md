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

## 自定义 Windows EXE 安装器

项目中的 `installer/` 使用纯 HTML/CSS/JavaScript 界面和一个精简的 Tauri 2/Rust
后端，不使用 MSI，也不使用 NSIS 的传统“上一步/下一步”界面。安装器包含准备安装、
真实进度、安装完成三个状态，不需要单独安装前端依赖或执行前端构建。

开发预览（使用模拟进度，不会写文件或注册表）：

```bash
npm run installer:dev
```

生成正式安装器（默认 Tauri 构建入口也会执行这一命令）：

```bash
npm run installer:build
# 或
npm run tauri:build
```

该命令按以下顺序工作：

1. 以 `--no-bundle` 构建主程序 `md-code.exe`，不会生成 MSI 或 NSIS 包。
2. 将主程序嵌入自定义安装器并构建安装器自身。
3. 只复制最终交付文件到 `release/MDCode_0.2.0_x64-setup.exe`。

`.fingerprint`、`build`、`deps`、`.pdb` 等内容只是 Cargo 编译缓存，不是需要发布的文件。
主程序和安装器的 Cargo 缓存分别保存在各自的 `src-tauri/target` 中，这两个目录
都不会提交到 Git，也不会在打包后自动删除。缓存会加速后续编译；第一次构建或手动
清理后仍需要完整编译一次。

需要手动释放 Cargo 缓存空间时执行：

```bash
npm run clean:cargo
```

如果只需要构建主程序 EXE、不生成安装器：

```bash
npm run tauri:build:app
```

安装时由 Rust 后端按数据块写入主程序，并把真实的文件写入进度发送给 HTML 页面；
随后创建开始菜单/可选桌面快捷方式，注册 Windows 卸载信息和“打开方式”。安装目录
内的 `uninstall.exe --uninstall` 负责删除应用文件、快捷方式和对应的当前用户注册表项。

```text
installer/
  ui/                     纯 HTML/CSS/JavaScript 单页安装界面
  src-tauri/
    src/lib.rs            文件复制、进度、快捷方式、注册表与卸载
    build.rs              将主程序 EXE 嵌入安装器
scripts/
  build-installer.mjs     主程序与安装器的串行构建入口
release/
  MDCode_0.2.0_x64-setup.exe
```

## 分层

```text
Application (src/app)
  -> Editor Store / future Document Manager (src/store, src/document)
    -> Markdown Editor (src/editor)
      -> Markdown Core + Plugin Registry (src/markdown)
```
