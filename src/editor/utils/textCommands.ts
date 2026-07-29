import type { EditorCommand, MermaidDiagramType, TextEdit, TextSelection } from '@/types/editor';

function selectedText(value: string, selection: TextSelection): string {
  return value.slice(selection.start, selection.end);
}

function replace(
  value: string,
  selection: TextSelection,
  replacement: string,
  selectStart = 0,
  selectLength = replacement.length
): TextEdit {
  return {
    value: value.slice(0, selection.start) + replacement + value.slice(selection.end),
    selection: {
      start: selection.start + selectStart,
      end: selection.start + selectStart + selectLength
    }
  };
}

function wrap(
  value: string,
  selection: TextSelection,
  before: string,
  after: string,
  placeholder: string
): TextEdit {
  const current = selectedText(value, selection) || placeholder;
  return replace(value, selection, before + current + after, before.length, current.length);
}

function prefixLines(value: string, selection: TextSelection, prefix: string): TextEdit {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  const nextLine = value.indexOf('\n', selection.end);
  const lineEnd = nextLine === -1 ? value.length : nextLine;
  const block = value.slice(lineStart, lineEnd);
  const replacement = block
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');

  return {
    value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
    selection: { start: lineStart, end: lineStart + replacement.length }
  };
}

function heading(value: string, selection: TextSelection, level: number): TextEdit {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  const nextLine = value.indexOf('\n', selection.end);
  const lineEnd = nextLine === -1 ? value.length : nextLine;
  const block = value.slice(lineStart, lineEnd);
  const replacement = block
    .split('\n')
    .map((line) => `${'#'.repeat(level)} ${line.replace(/^#{1,6}\s+/u, '')}`)
    .join('\n');
  return {
    value: value.slice(0, lineStart) + replacement + value.slice(lineEnd),
    selection: { start: lineStart, end: lineStart + replacement.length }
  };
}

function tableMarkdown(rows: number, columns: number): string {
  const header = `| ${Array.from({ length: columns }, (_, index) => `列 ${index + 1}`).join(' | ')} |`;
  const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`;
  const row = `| ${Array.from({ length: columns }, () => '内容').join(' | ')} |`;
  return [header, divider, ...Array.from({ length: rows }, () => row)].join('\n');
}

const mermaidTemplates: Record<MermaidDiagramType, string> = {
  flowchart: 'flowchart LR\n  A[开始] --> B{判断}\n  B -->|是| C[完成]\n  B -->|否| A',
  sequence: 'sequenceDiagram\n  participant A as 用户\n  participant B as 应用\n  A->>B: 发起请求\n  B-->>A: 返回结果',
  gantt: 'gantt\n  title 项目计划\n  dateFormat YYYY-MM-DD\n  section 开发\n  核心功能 :a1, 2026-07-28, 7d',
  class: 'classDiagram\n  class Document {\n    +String filename\n    +String content\n    +save()\n  }',
  state: 'stateDiagram-v2\n  [*] --> 阅读\n  阅读 --> 编辑\n  编辑 --> 阅读\n  阅读 --> [*]',
  pie: 'pie title 文档类型\n  "Markdown" : 70\n  "其他" : 30',
  er: 'erDiagram\n  DOCUMENT ||--o{ REVISION : contains\n  DOCUMENT {\n    string filename\n    string content\n  }',
  journey: 'journey\n  title Markdown 写作旅程\n  section 创作\n    打开文档: 5: 用户\n    编辑内容: 4: 用户\n    预览保存: 5: 用户'
};

export function applyTextCommand(
  value: string,
  selection: TextSelection,
  command: EditorCommand
): TextEdit {
  if (command.type === 'heading') return heading(value, selection, command.level);
  if (command.type === 'table') {
    return replace(value, selection, tableMarkdown(command.rows, command.columns), 0, 0);
  }
  if (command.type === 'formula') {
    return command.mode === 'inline'
      ? wrap(value, selection, '$', '$', 'E = mc^2')
      : wrap(value, selection, '$$\n', '\n$$', 'E = mc^2');
  }
  if (command.type === 'mermaid') {
    const source = mermaidTemplates[command.diagram];
    return replace(value, selection, `\`\`\`mermaid\n${source}\n\`\`\``, 11, source.length);
  }
  if (command.type === 'admonition') {
    const content = selectedText(value, selection) || '内容';
    const opening = `!!! ${command.kind} "标题"`;
    const template = `${opening}\n\n${content}\n\n!!!`;
    return replace(value, selection, template, opening.length + 2, content.length);
  }
  if (command.type === 'emoji') return replace(value, selection, command.value);
  if (command.type === 'image') {
    if (command.action === 'link') {
      return wrap(value, selection, '![', '](https://example.com/image.png)', '图片描述');
    }
    return { value, selection };
  }

  switch (command.command) {
    case 'bold':
      return wrap(value, selection, '**', '**', '粗体文本');
    case 'italic':
      return wrap(value, selection, '*', '*', '斜体文本');
    case 'strike':
      return wrap(value, selection, '~~', '~~', '删除线');
    case 'quote':
      return prefixLines(value, selection, '> ');
    case 'unordered-list':
      return prefixLines(value, selection, '- ');
    case 'ordered-list':
      return prefixLines(value, selection, '1. ');
    case 'task-list':
      return prefixLines(value, selection, '- [ ] ');
    case 'inline-code':
      return wrap(value, selection, '`', '`', 'code');
    case 'code-block':
      return wrap(value, selection, '```ts\n', '\n```', 'const value = true;');
    case 'link':
      return wrap(value, selection, '[', '](https://)', '链接文本');
    case 'undo':
    case 'redo':
      return { value, selection };
  }
}

