import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import type { EditorTheme, ResolvedTheme } from '@/types/editor';

export function useResolvedTheme(preference: Ref<EditorTheme>) {
  const systemDark = ref(false);
  let media: MediaQueryList | undefined;

  const sync = (event?: MediaQueryListEvent): void => {
    systemDark.value = event?.matches ?? media?.matches ?? false;
  };

  onMounted(() => {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    sync();
    media.addEventListener('change', sync);
  });

  onBeforeUnmount(() => media?.removeEventListener('change', sync));

  return computed<ResolvedTheme>(() => {
    if (preference.value === 'system') return systemDark.value ? 'dark' : 'light';
    return preference.value;
  });
}
