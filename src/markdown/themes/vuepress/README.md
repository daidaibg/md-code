# VuePress 2 preview theme

Adapted from the official `@vuepress/theme-default` **2.0.0-rc.132** (the npm
`next` release verified on 2026-09-03), not the former third-party `vuepress-theme`.

Upstream: https://github.com/vuepress/ecosystem/tree/700c97e4337ea7a488ef5a0c1fd5f4f41b4ded00

Sources at that revision:

- `themes/theme-default/src/client/styles/vars.scss`, `vars-dark.scss`, `_mixins.scss`
- `themes/theme-default/src/client/styles/content/normalize.scss`, `code.scss`
- `tools/helper/src/client/styles/normalize.scss`, `colors.scss`
- `tools/highlighter-helper/src/client/styles/base.scss`
- `plugins/markdown/plugin-markdown-hint/src/client/styles/hint.scss`, `vars.css`, `_icons.scss`

The upstream MIT notice is retained in `LICENSE` and the emitted CSS banner.

## Intentional desktop adaptations

- Theme ID `vuepress` remains stable for saved settings. The new CSS class is
  `vuepress-official-theme`, so the legacy theme in the shared vendor stylesheet
  no longer matches. Shared GitHub typography explicitly excludes this theme.
- Scope all rules/tokens to the preview host; never import upstream body, root,
  router, navbar, sidebar, reset or page-navigation behavior into the desktop app.
- Use a 740px readable content width plus padding, respecting this app's global
  border-box reset. Responsive rules follow the preview pane width rather than
  the whole window. Use natural heading spacing and existing anchor scrolling
  instead of upstream negative margins for a fixed website navbar.
- Keep the existing Highlight.js/code-style selector, copy action and neutral
  light/dark code surface. Do not install Prism/Shiki or override selected syntax
  colors; adapt the official code layout to `.md-editor-code`.
- Map the existing `!!!` admonition renderer onto official hint styling and SVG
  icons (`danger` uses upstream `caution`). This is a visual theme, not a VuePress
  Markdown compiler: it does not add `:::` containers, code tabs or Vue components.
- Preserve Mermaid label measurement, content scroll anchors and shared hidden
  scrollbars. Re-measure Mermaid on preview-theme changes using cached source.

Future updates should compare these exact upstream files and recheck light/dark
mode, nested hints, wide code/tables, narrow split panes and theme switching.
