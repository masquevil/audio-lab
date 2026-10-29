import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueRouter from 'vue-router/vite';

function getBase() {
  /**
   * about VITE_TARGET_ENV
   *  - pages: for GitHub Pages - hash mode, root path is `/audio-lab/`
   *  - hash: for servers do not support SPA - hash mode, root path is `/`
   *  - default: for any others (like sox-mini) - history mode, root path is `/`
   */

  const { VITE_TARGET_ENV } = process.env;
  switch (VITE_TARGET_ENV) {
    case 'pages':
      return '/audio-lab/';
    default:
      return '/';
  }
}

export default defineConfig({
  plugins: [VueRouter({ dts: 'src/router/typed-router.d.ts' }), vue()],
  base: getBase(),
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
