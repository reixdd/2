import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
export default defineConfig({
  testDir: './tests/public', workers: 1,
  use: { baseURL: 'http://127.0.0.1:8789', launchOptions: { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan'], executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) } },
  webServer: { command: 'node scripts/serve-public.mjs', url: 'http://127.0.0.1:8789', reuseExistingServer: false },
});
