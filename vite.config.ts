import { defineConfig } from 'vite';

// Relative base so the build works on any static host path (GitHub Pages project URL included).
export default defineConfig({
  base: './',
  build: { target: 'es2019', cssCodeSplit: false },
});
