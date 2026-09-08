export interface WorkspaceSession {
  settingsOpen: boolean;
  notesOpen: boolean;
  activeWorkspace: 'document' | 'settings' | 'notes';
  settingsSection: string;
}

// Uses the existing application WebView storage, under the application's data directory.
const KEY = 'md-code:workspace-tabs:v1';
const sections = new Set(['appearance', 'editor', 'files', 'notes', 'markdown']);

export function readWorkspaceSession(): WorkspaceSession {
  let saved: Partial<WorkspaceSession> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (value && typeof value === 'object') saved = value as Partial<WorkspaceSession>;
  } catch { /* Unavailable or invalid storage must not prevent startup. */ }
  const settingsOpen = saved.settingsOpen === true;
  const notesOpen = saved.notesOpen === true;
  return {
    settingsOpen, notesOpen,
    activeWorkspace: saved.activeWorkspace === 'settings' && settingsOpen ? 'settings'
      : saved.activeWorkspace === 'notes' && notesOpen ? 'notes' : 'document',
    settingsSection: typeof saved.settingsSection === 'string' && sections.has(saved.settingsSection)
      ? saved.settingsSection : 'appearance'
  };
}

export function saveWorkspaceSession(snapshot: WorkspaceSession): void {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot)); }
  catch (error) { console.warn('保存工作区标签失败', error); }
}
