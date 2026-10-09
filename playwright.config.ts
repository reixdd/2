import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests/ui',workers:1,timeout:30000,use:{viewport:{width:1440,height:900},baseURL:'http://127.0.0.1:8791',launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}},webServer:{command:'node scripts/serve-static.mjs',url:'http://127.0.0.1:8791',reuseExistingServer:false}})
