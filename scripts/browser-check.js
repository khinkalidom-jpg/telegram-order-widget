import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:344,height:830},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000');
 const f=page.frameLocator('#widget');
 await f.locator('#order').waitFor();
 assert.equal(await f.locator('#order').isDisabled(),true);
 const rect=await page.locator('#widget').boundingBox();assert.equal(rect.width,320);
 const frame=page.frames()[1];
 async function bounds(){const b=await frame.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.body.scrollHeight,button:document.getElementById('order').getBoundingClientRect().bottom}));assert.ok(b.width<=320,JSON.stringify(b));assert.ok(b.height<=560,JSON.stringify(b));assert.ok(b.button<=550,JSON.stringify(b));return b}
 const geometry=await bounds();
 await f.getByRole('button',{name:'Add Red Roses',exact:true}).click();
 await f.getByRole('button',{name:'Add Pink Tulips',exact:true}).click();
 assert.equal(await f.locator('#total').textContent(),'205 ₾');
 mkdirSync('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/preview-light-320.png'});
 await page.getByRole('button',{name:'Switch to dark'}).click();await bounds();
 await page.screenshot({path:'artifacts/preview-dark-320.png'});
 await f.locator('#order').click();assert.equal(await f.locator('#order').isDisabled(),true);
 await f.getByText('Demo order #PREVIEW-001',{exact:true}).waitFor();
 assert.match(await f.locator('#receipt').textContent(),/Total: 205 ₾/);
 await page.screenshot({path:'artifacts/preview-order-320.png'});
 await page.getByRole('button',{name:'New demo'}).click();
 await f.locator('#catalog').waitFor();
 for(let i=0;i<20;i++)await f.getByRole('button',{name:'Add Red Roses',exact:true}).click();
 assert.equal(await f.getByRole('button',{name:'Add Red Roses',exact:true}).isDisabled(),true);
 assert.equal(await f.locator('#q0').textContent(),'20');
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: 320px frame, light/dark, total, confirmation, reset, quantity limit, no JS errors.',geometry);
}finally{await browser.close()}
