import { createMemoryHistory, createRouter } from 'vue-router';
import AppShell from '@/app/AppShell.vue';
import { readWorkspaceSession } from '@/app/workspaceSession';

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      beforeEnter: (_to, from) => {
        // Restore only on startup, never intercept an explicit click on a document tab.
        if (from.matched.length) return;
        const session = readWorkspaceSession();
        if (session.activeWorkspace === 'settings') {
          return { name: 'settings', params: { section: session.settingsSection } };
        }
        if (session.activeWorkspace === 'notes') return { name: 'notes' };
      },
      component: AppShell
    },
    {
      path: '/settings/:section?',
      name: 'settings',
      component: AppShell
    },
    {
      path: '/notes',
      name: 'notes',
      component: AppShell
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
});
