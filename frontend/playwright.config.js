import { defineConfig, devices } from '@playwright/test';

// Pruebas en navegador: backend real con MySQL (base _e2e), frontend de Vite y un doble local del modelo.
const API = process.env.E2E_API_PORT || '3101';
const WEB = process.env.E2E_WEB_PORT || '5174';
const AI = process.env.E2E_FAKE_AI_PORT || '4599';
// Para usar un Chrome ya instalado en lugar del de Playwright: E2E_CHROME_PATH=/ruta/a/chrome.
const launchOptions = process.env.E2E_CHROME_PATH ? { executablePath: process.env.E2E_CHROME_PATH } : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${WEB}`, trace: 'retain-on-failure', launchOptions },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 }, launchOptions } },
    { name: 'movil', use: { ...devices['Pixel 7'], launchOptions }, grep: /@movil/ },
  ],
  webServer: [
    { command: `node e2e/support/fake-anthropic.mjs ${AI}`, url: `http://127.0.0.1:${AI}/__log`, reuseExistingServer: false },
    { command: 'node e2e/support/start-backend.mjs', url: `http://127.0.0.1:${API}/api/v1/health`, timeout: 120000, reuseExistingServer: false },
    {
      command: `npx vite --host 127.0.0.1 --port ${WEB} --strictPort`,
      url: `http://127.0.0.1:${WEB}/login`,
      env: { VITE_API_PROXY: `http://127.0.0.1:${API}` },
      reuseExistingServer: false,
    },
  ],
});
