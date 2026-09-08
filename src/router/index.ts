import { createMemoryHistory, createRouter } from 'vue-router';
import AppShell from '@/app/AppShell.vue';

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
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
