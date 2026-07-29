import type { EditorCommand } from '@/types/editor';
import { applyTextCommand } from '@/editor/utils/textCommands';
import type { monaco } from '@/editor/monaco/setupMonaco';

export function executeMarkdownCommand(
  editor: monaco.editor.IStandaloneCodeEditor,
  command: EditorCommand
): boolean {
  if (command.type === 'simple' && command.command === 'undo') {
    editor.trigger('markdown-toolbar', 'undo', null);
    return true;
  }
  if (command.type === 'simple' && command.command === 'redo') {
    editor.trigger('markdown-toolbar', 'redo', null);
    return true;
  }
  if (command.type === 'image' && command.action !== 'link') return false;

  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return false;

  const source = model.getValue();
  const start = model.getOffsetAt(selection.getStartPosition());
  const end = model.getOffsetAt(selection.getEndPosition());
  const edit = applyTextCommand(source, { start, end }, command);

  editor.pushUndoStop();
  editor.executeEdits('markdown-toolbar', [
    { range: model.getFullModelRange(), text: edit.value, forceMoveMarkers: true }
  ]);
  editor.pushUndoStop();

  const selectionStart = model.getPositionAt(edit.selection.start);
  const selectionEnd = model.getPositionAt(edit.selection.end);
  editor.setSelection({
    startLineNumber: selectionStart.lineNumber,
    startColumn: selectionStart.column,
    endLineNumber: selectionEnd.lineNumber,
    endColumn: selectionEnd.column
  });
  editor.focus();
  return true;
}
