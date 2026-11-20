/**
 * Screenshot run for the redesign review (not part of `npx playwright test`):
 *   npx playwright test -c playwright.shots.config.ts
 * Writes PNGs to docs/redesign/ (or SHOTS_DIR) at 1280×800 and 390×844, light and dark.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5206;

export default defineConfig({
  testDir: './e2e-shots',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npx vite --mode demo --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_X10_LATENCY: '0' },
  },
});
