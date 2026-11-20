import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react({
      useAtYourOwnRisk_mutateSwcOptions({ jsc }) {
        if (!jsc?.parser) return;
        jsc.parser.decorators = true;
        jsc.transform = { ...jsc.transform, decoratorVersion: '2022-03' };
      },
    }),
  ],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
