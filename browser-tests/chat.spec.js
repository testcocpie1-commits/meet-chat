import {test,expect} from '@playwright/test';
test('two real visitors chat, quote, report, and administrator moderates',async({browser})=>{
 const ca=await browser.newContext(),cb=await browser.newContext(),a=await ca.newPage(),b=await cb.newPage();
 const errors=[];a.on('pageerror',e=>errors.push(e.message));b.on('pageerror',e=>errors.push(e.message));
 await a.goto('/');await b.goto('/');await expect(a.locator('#online')).toContainText('在线');await expect(b.locator('#online')).toContainText('在线');
 for(const p of [a,b]){await p.locator('#consent').check();await p.locator('#phrase').fill('浏览器测试');}
 await b.locator('input[value=female]').check();await a.locator('input[value=opposite]').check();
 await a.locator('#join').click();await b.locator('#join').click();await expect(a.locator('#status')).toContainText('对方已连接');await expect(b.locator('#status')).toContainText('对方已连接');
 await expect(a.locator('#emojis button')).toHaveCount(5);
 await a.waitForTimeout(850);await a.locator('#text').fill('你好，世界！');await a.locator('#send').click();
 await expect(b.locator('.message')).toContainText('你好，世界！');await b.locator('.message').click();await expect(b.locator('#reply')).toBeVisible();await b.locator('#text').fill('很高兴遇见你');await b.locator('#send').click();await expect(a.locator('.message blockquote')).toHaveText('你好，世界！');
 await a.locator('#lang').click();await expect(a.locator('#report')).toHaveText('檢舉');await a.locator('#report').click();await expect(a.locator('#reportDialog')).toBeVisible();await a.locator('#reportForm button[type=submit], #reportForm .primary').click();await expect(b.locator('#status')).toContainText('已离开');
 const admin=await ca.newPage();await admin.goto('/admin');await admin.locator('#password').fill('browser-test-only-password');await admin.locator('#loginButton').click();await expect(admin.locator('#dashboard')).toBeVisible();await admin.locator('summary').first().click();await expect(admin.locator('pre').first()).toContainText('很高兴遇见你');await admin.getByRole('button',{name:'限制裝置 24 小時'}).first().click();await expect(admin.locator('#reports')).toContainText('限制裝置 24 小時');
 await expect(b.locator('#error')).toContainText('限制使用');expect(errors).toEqual([]);
 await a.screenshot({path:'test-results/desktop.png',fullPage:true});await ca.close();await cb.close();
});
test('mobile layout and both Chinese locales',async({browser})=>{const c=await browser.newContext({viewport:{width:390,height:844}});const p=await c.newPage();await p.goto('/');await expect(p.locator('#join')).toBeVisible();expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.locator('#lang').click();await expect(p.locator('html')).toHaveAttribute('lang','zh-Hant');await expect(p.locator('#join')).toHaveText('開始配對');await p.screenshot({path:'test-results/mobile.png',fullPage:true});await c.close();});
