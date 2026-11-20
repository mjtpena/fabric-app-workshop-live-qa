/**
 * UI kit playground (not part of any app build): `npm run playground -w shared` → http://localhost:5200
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss()],
  server: { port: 5200, strictPort: true },
  preview: { port: 5200, strictPort: true },
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 2000 },
});
