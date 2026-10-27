import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sete-povos/',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
