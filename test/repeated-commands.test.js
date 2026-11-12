import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {ShopStore} from '../src/shop-store.js';
import {openView,storefrontQuery,syncViews} from '../src/storefront-service.js';
const fixture=()=>{let seq=100;const calls=[];return {calls,api:async(m,p)=>{calls.push([m,p]);return {message_id:++seq}}}};
test('simultaneous /start commands create one screen; later /start retains bag and sends a fresh menu',async()=>{
 const s=new ShopStore(':memory:'),{calls,api}=fixture();let x=s.open(1,1);s.apply(x.id,1,'add',x.rev,'r');
 await Promise.all([openView(s,api,1,1,'home',null,{now:1000}),openView(s,api,1,1,'home',null,{now:1001})]);
 assert.equal(calls.filter(([m])=>m==='sendWidget').length,1);assert.equal(s.session(1).cart.r,1);
 await openView(s,api,1,1,'home',null,{now:61000});assert.equal(calls.filter(([m])=>m==='sendWidget').length,2);assert.equal(s.session(1).cart.r,1);s.close();
});
test('deduplication survives reopen and a menu-registration error after sending',async()=>{
 const dir=mkdtempSync('/tmp/bloom-repeat-'),{calls,api}=fixture();let s=new ShopStore(dir+'/db');
 try{await assert.rejects(openView(s,async(m,p)=>{if(m==='setMyCommands')throw Error('network');return api(m,p)},1,1,'home',null,{now:1000}));s.close();s=new ShopStore(dir+'/db');await openView(s,api,1,1,'home',null,{now:2000});assert.equal(calls.filter(([m])=>m==='sendWidget').length,1)}finally{s.close();rmSync(dir,{recursive:true})}
});
test('an intervening handled update or changed screen permits immediate navigation',async()=>{
 const s=new ShopStore(':memory:'),{calls,api}=fixture();s.offset(10);await openView(s,api,1,1,'home',null,{now:1000,updateId:10});s.offset(11);
 await openView(s,api,1,1,'home',null,{now:2000,updateId:11});assert.equal(calls.filter(([m])=>m==='sendWidget').length,1);
 s.offset(13); // e.g. /admin was handled between commands; admin code is unchanged.
 await openView(s,api,1,1,'home',null,{now:3000,updateId:13});assert.equal(calls.filter(([m])=>m==='sendWidget').length,2);
 await openView(s,api,1,1,'cart',null,{now:4000});await openView(s,api,1,1,'home',null,{now:5000});assert.equal(calls.filter(([m])=>m==='sendWidget').length,4);s.close();
});
test('double widget taps do not replay additions or create extra screens',async()=>{
 const s=new ShopStore(':memory:'),{calls,api}=fixture();await openView(s,api,1,1,'home');const v=s.db.prepare('SELECT * FROM views WHERE active=1').get();const q={id:'q',from:{id:1},chat:{id:1},message_id:v.message,type:{type:'data'},data:JSON.stringify(['add',s.session(1).rev,'r'])};
 await Promise.all([storefrontQuery(q,s,api),storefrontQuery({...q,id:'q2'},s,api)]);await syncViews(s,api);assert.equal(s.session(1).cart.r,1);assert.equal(calls.filter(([m])=>m==='sendWidget').length,1);s.close();
});
test('worker racing initial command cannot send a second screen',async()=>{
 const s=new ShopStore(':memory:'),{calls,api}=fixture();let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const opening=openView(s,async(m,p)=>{if(m==='sendWidget'){entered();await gate}return api(m,p)},1,1,'home');await started;const syncing=syncViews(s,api);release();await Promise.all([opening,syncing]);assert.equal(calls.filter(([m])=>m==='sendWidget').length,1);s.close();
});
test('failed screen delivery is retried; commands from other owners are independent',async()=>{
 const s=new ShopStore(':memory:'),{calls,api}=fixture();await assert.rejects(openView(s,async()=>{throw Error('offline')},1,1,'home',null,{now:1000}));await openView(s,api,1,1,'home',null,{now:2000});await openView(s,api,2,2,'home',null,{now:2001});assert.equal(calls.filter(([m])=>m==='sendWidget').length,2);s.close();
});
