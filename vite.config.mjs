import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(import.meta.dirname, 'ui-src'),
  base: './',
  build: {
    outDir: path.resolve(import.meta.dirname, 'ui-dist'),
    emptyOutDir: true,
  },
});
