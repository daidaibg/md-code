import { createRouter, createWebHashHistory } from 'vue-router';
import AppShell from '@/app/AppShell.vue';

export const router = createRouter({
  history: createWebHashHistory(),
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
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
});
