# Design QA — MD Code 自定义 Windows 安装器

## Source

- Reference image: `C:\Users\daida\AppData\Local\Temp\codex-clipboard-1ba48ae9-ba73-4e5e-85c8-50a991a679f4.png`
- Implementation screenshot: `D:\pro\MyPro\md\md-code\design-qa\installer-progress.png`
- Side-by-side comparison: `D:\pro\MyPro\md\md-code\design-qa\installer-progress-comparison.png`
- Additional states:
  - `D:\pro\MyPro\md\md-code\design-qa\installer-ready.png`
  - `D:\pro\MyPro\md\md-code\design-qa\installer-complete.png`

## QA setup

- Viewport: 880 × 620 (matches the configured Tauri installer window)
- Compared state: installing/progress
- Runtime: local Vite preview using the browser-only mock progress adapter

## Visual comparison

- Window: white, rounded, centered, restrained shadow and large surrounding whitespace.
- Header: custom minimal minimize/close controls remain in the top-right corner.
- Brand: supplied MD Code logo and centered product name preserve the reference hierarchy.
- Progress: long horizontal track, blue fill, centered `已安装 xx%` label and secondary status text.
- Initial page: centered primary action, editable path, folder selector, desktop shortcut option and collapsible custom options.
- Completion page: centered success copy, launch checkbox and one primary completion action.
- No traditional Windows wizard chrome, step rail, “上一步/下一步” controls or MSI UI is present.

## Interaction checks

- `立即安装` changes the page from ready to installing.
- Mock progress advances through multiple percentages and ends at 100%.
- The completion page appears automatically after progress reaches 100%.
- Custom options collapse and expand correctly.
- Installation path input is available when custom options are expanded.
- Desktop shortcut checkbox can be toggled.
- Browser console warnings/errors: none.

## QA history

1. Removed decorative gradients to keep the requested clean blue/white commercial-software style.
2. Removed a CSS-drawn completion badge and retained the real supplied application asset.
3. Corrected shared icon selectors so window and folder icons render in the standalone installer.
4. Compared the reference and implementation together; confirmed matching layout hierarchy and progress-page emphasis.

## Final result

passed
