import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopStore} from '../src/shop-store.js';
import {openView,storefrontQuery,cardCallback,cardPayload} from '../src/storefront-service.js';
import {adminUpdate} from '../src/admin.js';
import {drainJobs} from '../src/service.js';
import {timeOptions,validateTime} from '../src/order-time.js';
import {storefrontHTML} from '../src/storefront.js';
import {checkSizes} from '../src/sizes.js';
const setup=()=>{const s=new ShopStore(':memory:');s.open(1,1);return s};
const act=(s,a,p)=>s.apply(1,1,a,s.session(1).rev,p);
const cb=(id,data,user=1)=>({callback_query:{id:'q',from:{id:user},message:{message_id:20,chat:{id,type:'private'}},data}});
test('Tbilisi slots respect lead time, closing hours, date rollover and invalid requests',()=>{
 const s=setup();const now=Date.parse('2026-11-12T18:30:00+04:00');
 assert.deepEqual(timeOptions(s.db,0,now),[]);
 const tomorrow=timeOptions(s.db,1,now);assert.equal(tomorrow[0],'2026-11-13T09:00:00+04:00');
 for(const value of ['2020-01-01T09:00:00+04:00','tomorrow',null,''])assert.throws(()=>validateTime(s.db,value));
 assert.doesNotThrow(()=>validateTime(s.db,'asap'));
 s.db.prepare("INSERT INTO metadata VALUES('order_time_config',?)").run(JSON.stringify({lead:30,open:8,close:22}));
 assert.equal(timeOptions(s.db,0,now)[0],'2026-11-12T19:00:00+04:00');s.close();
});
test('checkout requires time, rechecks price, stores two lines and desired time, does not duplicate order',()=>{
 const s=setup();act(s,'add','r');act(s,'add','t');assert.equal(act(s,'review').s,'time');assert.equal(s.db.prepare('SELECT count(*) n FROM orders').get().n,0);
 const slot=timeOptions(s.db,1)[0];act(s,'time',slot);s.db.prepare("UPDATE products SET price=price+1 WHERE id='r'").run();assert.equal(act(s,'order').o,0);
 const rev=s.session(1).rev;const receipt=act(s,'order');assert.ok(receipt.o);s.apply(1,1,'order',rev);
 const rows=s.db.prepare('SELECT * FROM orders').all();assert.equal(rows.length,1);const body=JSON.parse(rows[0].body);assert.equal(body.desiredTime,slot);assert.equal(body.items.length,2);assert.equal(receipt.when,slot);s.close();
});
test('status callbacks require owner and create one queued customer message per transition',async()=>{
 const s=setup();act(s,'add','r');act(s,'review');act(s,'time','asap');act(s,'order');const calls=[],api=async(m,p)=>{calls.push([m,p]);return {message_id:50}};
 await adminUpdate(cb(1,'order:accepted:1',2),s,api,'1');assert.equal(s.db.prepare('SELECT count(*) n FROM order_status').get().n,0);
 for(const status of ['ready','accepted','accepted','ready','ready','cancelled'])await adminUpdate(cb(1,'order:'+status+':1'),s,api,'1');
 assert.equal(s.db.prepare('SELECT status FROM order_status').get().status,'ready');
 await drainJobs(s,api,'1');await drainJobs(s,api,'1');const messages=calls.filter(([m])=>m==='sendMessage');assert.equal(messages.length,3);assert.match(messages[0][1].text,/ADMIN/);assert.equal(messages[0][1].reply_markup.inline_keyboard.flat().length,4);assert.match(messages[1][1].text,/accepted/);assert.match(messages[2][1].text,/ready/);
 assert.equal(s.due().length,0);s.close();
});
test('cancel and missing admin retries preserve jobs; rejected send stays queued',async()=>{
 const s=setup();act(s,'add','r');act(s,'review');act(s,'time','asap');act(s,'order');
 await drainJobs(s,async()=>{throw Error('offline')},undefined);const job=s.db.prepare("SELECT * FROM jobs WHERE kind='admin'").get();assert.equal(job.done,0);assert.equal(job.attempts,1);
 await adminUpdate(cb(1,'order:cancelled:1'),s,async()=>({}),'1');await adminUpdate(cb(1,'order:cancelled:1'),s,async()=>({}),'1');assert.equal(s.db.prepare("SELECT count(*) n FROM jobs WHERE kind='status:cancelled'").get().n,1);s.close();
});
test('active HTML navigation returns actual screen; native reentry sends new bottom card; next edits it',async()=>{
 const s=new ShopStore(':memory:');for(const p of s.products())s.saveProduct({...p,photo:'file-'+p.id});const calls=[];let seq=100;const api=async(m,p)=>{calls.push([m,p]);return {message_id:++seq}};
 await openView(s,api,1,1,'home');let view=s.db.prepare('SELECT * FROM views WHERE active=1').get();
 const query=async a=>{const q={id:'q',from:{id:1},chat:{id:1},message_id:view.message,type:{type:'data'},data:JSON.stringify([a,s.session(1).rev])};await storefrontQuery(q,s,api);return q};
 await query('builder');assert.equal(JSON.parse(calls.at(-1)[1].data).s,'builder');assert.ok(calls.some(([m,p])=>m==='editMessageWidgetData'&&p.message_id===view.message));
 const q=await query('catalog');await storefrontQuery(q,s,api);assert.equal(calls.filter(([m])=>m==='sendPhoto').length,1);
 let card=s.db.prepare('SELECT * FROM cards WHERE active=1').get();const press=async a=>{const data=cardPayload(s,s.session(1)).reply_markup.inline_keyboard.flat().find(b=>JSON.parse(b.callback_data)[3]===a).callback_data;await cardCallback({id:'c',from:{id:1},message:{chat:{id:1},message_id:card.message},data},s,api)};
 await press('next');assert.equal(calls.filter(([m])=>m==='sendPhoto').length,1);await press('home');view=s.db.prepare('SELECT * FROM views WHERE active=1').get();await query('catalog');assert.equal(calls.filter(([m])=>m==='sendPhoto').length,2);s.close();
});
test('time configuration is owner-only; widget scripts parse and respect UTF8 budgets',async()=>{
 const s=setup(),api=async()=>({});await adminUpdate(cb(2,'adm:timeCfg:lead',2),s,api,'1');assert.equal(s.db.prepare('SELECT count(*) n FROM admin_drafts').get().n,0);
 await adminUpdate(cb(1,'adm:timeCfg:lead'),s,api,'1');await adminUpdate({message:{from:{id:1},chat:{id:1,type:'private'},text:'120'}},s,api,'1');assert.equal(JSON.parse(s.db.prepare("SELECT value FROM metadata WHERE key='order_time_config'").get().value).lead,120);
 for(const lang of ['ru','ka','en']){const html=storefrontHTML(lang);new Function(html.slice(html.indexOf('<script>')+8,html.indexOf('</script>')));checkSizes(html)}s.close();
});
test('old deployed HTML is replaced on first navigation without losing the bag',async()=>{
 const s=setup();s.bind(s.session(1),10);act(s,'add','r');s.db.exec('UPDATE views SET version=0');const calls=[];await storefrontQuery({id:'q',from:{id:1},chat:{id:1},message_id:10,type:{type:'data'},data:JSON.stringify(['cart',s.session(1).rev])},s,async(m,p)=>{calls.push([m,p]);return {message_id:11}});assert.ok(calls.some(([m])=>m==='sendWidget'));assert.equal(s.session(1).cart.r,1);assert.equal(s.db.prepare('SELECT version FROM views WHERE active=1').get().version,2);s.close();
});
test('after receipt the home builder can start a separate new order',()=>{
 const s=setup();act(s,'add','r');act(s,'review');act(s,'time','asap');act(s,'order');act(s,'home');act(s,'again','builder');assert.equal(s.session(2).screen,'builder');assert.deepEqual(s.session(2).cart,{});assert.equal(s.db.prepare('SELECT count(*) n FROM orders').get().n,1);s.close();
});
