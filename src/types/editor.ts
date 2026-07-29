export type EditorTheme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type EditorMode = 'preview' | 'split' | 'editor';

export type SupportedLanguage =
  | 'markdown'
  | 'json'
  | 'html'
  | 'css'
  | 'javascript'
  | 'typescript'
  | 'yaml'
  | 'xml'
  | 'plaintext';

export type PreviewKind = 'markdown' | 'html' | 'json' | 'none';

export type PreviewThemeName =
  | 'default'
  | 'github'
  | 'vuepress'
  | 'mk-cute'
  | 'smart-blue'
  | 'cyanosis'
  | (string & {});

export type CodeThemeName =
  | 'atom'
  | 'a11y'
  | 'github'
  | 'gradient'
  | 'kimbie'
  | 'paraiso'
  | 'qtcreator'
  | 'stackoverflow'
  | (string & {});

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface EditorDocument {
  id: string;
  path: string | null;
  filename: string;
  language: SupportedLanguage;
  content: string;
  modified: boolean;
  mode: EditorMode;
  cursor: CursorPosition;
}

export interface ExternalFileConflict {
  documentId: string;
  path: string;
  filename: string;
  localContent: string;
  localModified: boolean;
  diskContent: string;
  diskAvailable: boolean;
  changeKind: string;
  detectedAt: number;
}

export type MarkdownDocument = EditorDocument;

export interface RecentFile {
  path: string;
  filename: string;
  lastOpenTime: number;
  count: number;
}

export interface SessionSnapshot {
  version: 2;
  documents: EditorDocument[];
  activeDocumentId: string;
  savedContents: Record<string, string>;
  recentFiles: RecentFile[];
  theme: EditorTheme;
  previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName;
}

export interface TextSelection {
  start: number;
  end: number;
}

export interface TextEdit {
  value: string;
  selection: TextSelection;
}

export type SimpleToolbarCommand =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'quote'
  | 'unordered-list'
  | 'ordered-list'
  | 'task-list'
  | 'inline-code'
  | 'code-block'
  | 'link';

export type MermaidDiagramType =
  | 'flowchart'
  | 'sequence'
  | 'gantt'
  | 'class'
  | 'state'
  | 'pie'
  | 'er'
  | 'journey';

export type AdmonitionKind =
  | 'note'
  | 'info'
  | 'tip'
  | 'warning'
  | 'danger'
  | (string & {});

export type EditorCommand =
  | { type: 'simple'; command: SimpleToolbarCommand }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'table'; rows: number; columns: number }
  | { type: 'formula'; mode: 'inline' | 'block' }
  | { type: 'mermaid'; diagram: MermaidDiagramType }
  | { type: 'admonition'; kind: AdmonitionKind }
  | { type: 'emoji'; value: string }
  | { type: 'image'; action: 'link' | 'upload' | 'crop' };

export interface TocItem {
  id: string;
  level: number;
  text: string;
}

export type ToolbarIconName =
  | 'undo'
  | 'redo'
  | 'heading'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'quote'
  | 'unordered-list'
  | 'ordered-list'
  | 'task-list'
  | 'inline-code'
  | 'code-block'
  | 'link'
  | 'image'
  | 'table'
  | 'mermaid'
  | 'admonition'
  | 'formula'
  | 'emoji'
  | 'preview'
  | 'split'
  | 'editor'
  | 'toc'
  | 'new-file'
  | 'open'
  | 'save'
  | 'save-as'
  | 'minimize'
  | 'close'
  | 'file'
  | 'recent'
  | 'search'
  | 'sun'
  | 'moon';
