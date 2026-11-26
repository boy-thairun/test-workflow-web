import { defineConfig, devices } from '@playwright/test';

const url = 'http://127.0.0.1:5181';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: url, ...devices['Desktop Chrome'], channel: 'chromium' },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 5181 --strictPort',
    url,
  },
});
