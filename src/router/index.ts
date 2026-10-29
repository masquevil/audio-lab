import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import { routes, handleHotUpdate } from 'vue-router/auto-routes';

const isHashMode = ['pages', 'hash'].includes(import.meta.env.VITE_TARGET_ENV || '');

const router = createRouter({
  history: isHashMode
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
  routes,
});

if (import.meta.hot) {
  handleHotUpdate(router);
}

export default router;
