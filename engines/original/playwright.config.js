import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
export default defineConfig({
  testDir: './tests/ui', workers: 1,
  use: { baseURL: 'http://127.0.0.1:8788', launchOptions: { executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) } },
  webServer: { command: 'node server/tests/ui-server.mjs', url: 'http://127.0.0.1:8788/api/challenges', reuseExistingServer: false },
});
