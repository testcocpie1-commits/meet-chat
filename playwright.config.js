import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({testDir:'./browser-tests',workers:1,use:{baseURL:'http://127.0.0.1:3101',launchOptions:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{}},webServer:{command:'node server.js',url:'http://127.0.0.1:3101',env:{PORT:'3101',ADMIN_PASSWORD:'browser-test-only-password',DB_PATH:'/tmp/meet-browser-'+Date.now()+'.sqlite'},reuseExistingServer:false}});
