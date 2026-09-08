import type { Nodes, Paragraph, Root } from 'mdast';
import { defaultHandlers, type Options } from 'mdast-util-to-markdown';
import { $remark } from '@milkdown/kit/utils';

function blank(node: Nodes): boolean {
  // Milkdown omits children when serializing an empty trailing paragraph.
  return node.type === 'paragraph' && (!node.children?.length || node.children.every(child =>
    (child.type === 'text' && /^[\t ]*$/u.test(child.value)) ||
    // Milkdown emits this sentinel for an editable empty paragraph.
    (child.type === 'html' && /^<br\s*\/?>$/u.test(child.value))
  ));
}

export const remarkVisualBlankLines = $remark('note-blank-lines', () => function () {
  const extensions = this.data('toMarkdownExtensions') ?? [];
  const extension: Options = {
    handlers: {
      paragraph(node: Paragraph, parent, state, info) {
        if (parent?.type === 'root' && blank(node)) {
          return (node.children ?? []).map(child => child.type === 'text' ? child.value : '').join('');
        }
        return defaultHandlers.paragraph(node, parent, state, info);
      },
      root(node: Root, parent, state, info) {
        const children = node.children ?? [];
        if (children.length && children.every(blank)) return '\n'.repeat(children.length);
        const output = defaultHandlers.root(node, parent, state, info);
        // The final newline terminates the last empty source line.
        return output + (children.length && blank(children.at(-1)!) ? '\n' : '');
      }
    },
    join: [(left, right, parent) => {
      if (parent.type !== 'root') return;
      if (blank(left) || blank(right)) return 0;
      // After deleting the editable blank line, don't silently insert it again.
      if (left.type === 'paragraph' && right.type === 'paragraph') return 0;
      if (left.type === 'heading' || right.type === 'heading' ||
        left.type === 'code' || right.type === 'code' ||
        left.type === 'noteAdmonition' || right.type === 'noteAdmonition') return 0;
    }]
  };
  this.data('toMarkdownExtensions', [...extensions, extension]);
  return (tree: Root, file) => {
    const source = String(file).replace(/\r\n?/gu, '\n');
    const lines = source.split('\n');
    if (lines.at(-1) === '') lines.pop();
    const children: Root['children'] = [];
    let nextLine = 0;
    function appendBlankLines(end: number) {
      for (; nextLine < end; nextLine++) {
        const whitespace = lines[nextLine] ?? '';
        if (/^[\t ]*$/u.test(whitespace)) children.push({ type: 'paragraph',
          children: whitespace ? [{ type: 'text', value: whitespace }] : [] });
      }
    }
    for (const child of tree.children) {
      if (child.position) appendBlankLines(child.position.start.line - 1);
      children.push(child);
      if (child.position) nextLine = child.position.end.line;
    }
    appendBlankLines(lines.length);
    tree.children = children;
  };
});
