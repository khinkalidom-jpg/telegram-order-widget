import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {storefrontHTML} from '../src/storefront.js';
import {words} from '../src/i18n.js';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));mkdirSync('artifacts/ux',{recursive:true});
 const frame=()=>page.frameLocator('iframe').last();
 async function bounds(){for(const f of page.frames().slice(1)){const d=await f.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.body.scrollHeight}));assert.ok(d.w<=page.viewportSize().width,JSON.stringify(d));assert.ok(d.h<=600,JSON.stringify(d))}}
 for(const lang of ['en','ru','ka'])for(const width of [320,390,430]){
 const t=words[lang];await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:'light'});await page.request.post('http://127.0.0.1:3000/reset',{data:{lang}});await page.goto('http://127.0.0.1:3000');await frame().getByRole('button',{name:t.catalog,exact:true}).waitFor();await bounds();await frame().getByRole('button',{name:t.catalog,exact:true}).click();await page.locator('.photo').waitFor();assert.equal(await page.locator('iframe').count(),0);
 for(let i=0;i<4;i++){await page.locator('.photo').getByRole('button',{name:t.add,exact:true}).click();await page.locator('.photo').getByRole('button',{name:t.added,exact:true}).waitFor();if(i<3){await page.locator('.photo').getByRole('button',{name:t.next,exact:true}).click();await page.locator('.photo').getByRole('button',{name:t.add,exact:true}).waitFor()}}
 await page.screenshot({path:`artifacts/ux/card-${lang}-${width}.png`,fullPage:true});
 await page.locator('.photo').getByRole('button',{name:t.cart+' · 4',exact:true}).click();await frame().getByRole('button',{name:t.checkout,exact:true}).waitFor();assert.equal(await page.locator('.photo').count(),0);assert.equal(await page.locator('iframe').count(),1);assert.equal(await frame().locator('.line').count(),4);await bounds();await page.screenshot({path:`artifacts/ux/bag-${lang}-${width}.png`,fullPage:true});
 await frame().getByRole('button',{name:t.checkout,exact:true}).click();await frame().getByRole('button',{name:t.asap,exact:true}).waitFor();await bounds();await frame().getByRole('button',{name:t.tomorrow,exact:true}).click();await frame().getByRole('button',{name:'09:00–10:00',exact:true}).waitFor();await bounds();await page.screenshot({path:`artifacts/ux/time-${lang}-${width}.png`,fullPage:true});await frame().getByRole('button',{name:'09:00–10:00',exact:true}).click();await frame().getByRole('button',{name:t.confirm,exact:true}).click();await frame().getByRole('heading',{name:t.thanks,exact:true}).waitFor();assert.equal(await frame().locator('.line').count(),4);await bounds();
 await frame().getByRole('button',{name:t.home,exact:true}).click();await frame().getByRole('button',{name:t.builder,exact:true}).click();await frame().getByRole('button',{name:t.other,exact:true}).waitFor();await bounds();
 for(const value of ['1','2','37','1000']){let actions=0;const listener=r=>{if(r.url().endsWith('/action'))actions++};page.on('request',listener);await frame().getByRole('button',{name:t.other,exact:true}).click();for(const digit of value)await frame().getByRole('button',{name:digit,exact:true}).click();assert.equal(actions,0);await bounds();await frame().getByRole('button',{name:t.done,exact:true}).click();await frame().getByRole('button',{name:t.other,exact:true}).waitFor();assert.equal(actions,1);page.off('request',listener);const state=await(await page.request.get('http://127.0.0.1:3000/state')).json();assert.equal(JSON.parse(state.find(m=>m.kind==='widget').chat_data).b.n,Number(value))}
 await page.screenshot({path:`artifacts/ux/builder-${lang}-${width}.png`,fullPage:true});console.log(`${lang} ${width}px: native card, four bag rows, checkout, keypad passed`);
 }
 const timePage=await browser.newPage({viewport:{width:320,height:900}});
 for(const lang of ['ru','ka','en']){
  const state={s:'time',l:lang,r:1,day:1,date:'2026-11-13',slots:Array.from({length:24},(_,h)=>'2026-11-13T'+String(h).padStart(2,'0')+':00:00+04:00')};
  const adapter='<script>window.TelegramWidget={chatData:'+JSON.stringify(JSON.stringify(state))+',onEvent(){},ready(){}};</script>';
  await timePage.setContent(storefrontHTML(lang).replace('<script>',adapter+'<script>'));
  const height=await timePage.evaluate(()=>document.body.scrollHeight);assert.ok(height<=600,lang+' full-day time picker height '+height);
 }
 await timePage.close();
 assert.deepEqual(errors,[]);console.log('Browser checks passed; these are Chromium checks, not iPhone verification.');
}finally{await browser.close()}
