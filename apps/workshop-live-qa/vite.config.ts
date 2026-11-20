import { rayfinLocalDev } from '@microsoft/rayfin-local-dev/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // A Fabric build must carry the Rayfin publishable key; fail early instead of shipping a broken bundle.
  if (command === 'build' && mode === 'fabric') {
    if (!env.VITE_RAYFIN_API_URL || !env.VITE_RAYFIN_PUBLISHABLE_KEY) {
      throw new Error(
        'Missing VITE_RAYFIN_API_URL / VITE_RAYFIN_PUBLISHABLE_KEY. Run `npx rayfin up` (it runs build:fabric after writing rayfin/.env).',
      );
    }
  }

  return {
    plugins: [
      react({
        // Rayfin entities use TC39 Stage-3 decorators.
        useAtYourOwnRisk_mutateSwcOptions({ jsc }) {
          if (!jsc?.parser) return;
          jsc.parser.decorators = true;
          jsc.transform = { ...jsc.transform, decoratorVersion: '2022-03' };
        },
      }),
      tailwindcss(),
      ...(mode === 'demo' ? [] : [rayfinLocalDev()]),
    ],
    resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
    build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
    esbuild: { target: 'es2022' },
    optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  };
});
