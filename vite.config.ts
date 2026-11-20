import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // HTML in Canvas 技術検証ページ（TMS 23〜28）
        hicBasic: resolve(__dirname, 'spikes/hic-basic.html'),
        hicInput: resolve(__dirname, 'spikes/hic-input.html'),
        hicThree: resolve(__dirname, 'spikes/hic-three.html'),
        // デザインの見本（TMS 32）
        styleGuide: resolve(__dirname, 'spikes/style-guide.html'),
      },
    },
  },
});
