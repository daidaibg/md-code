import type { Pinia } from 'pinia';
import { watch } from 'vue';
import { useEditorStore } from '@/store/editor';
import type { SessionSnapshot } from '@/types/editor';

const SESSION_KEY = 'md-code:session:v1';

export function restoreEditorSession(pinia: Pinia): void {
  const store = useEditorStore(pinia);
  try {
    const source = localStorage.getItem(SESSION_KEY);
    if (!source) return;
    store.restoreSnapshot(JSON.parse(source) as SessionSnapshot);
  } catch (error) {
    console.warn('恢复编辑会话失败', error);
  }
}

export function installEditorSessionPersistence(pinia: Pinia): () => void {
  const store = useEditorStore(pinia);
  let timer = 0;
  return watch(
    () => store.createSnapshot(),
    (snapshot) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
        } catch (error) {
          console.warn('保存自动恢复缓存失败', error);
        }
      }, 350);
    },
    { deep: true }
  );
}
