import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopStore} from '../src/shop-store.js';
import {adminUpdate} from '../src/admin.js';
import {openView} from '../src/storefront-service.js';
const snapshots=s=>Object.fromEntries(['rose_options','builder_settings','products','orders','jobs'].map(t=>[t,s.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));
for(const step of ['name','description','price','photo','publish','rosePrice','bounds','translation']){
 test('/start exits admin step '+step+' without changing published data',async()=>{
 const s=new ShopStore(':memory:');s.setRose('color','red',1500);s.setRose('wrap','paper',500);s.setLimits(1,1000);s.register(1,100,1);s.place(1,100,1,'[["r",1]]');const before=snapshots(s);
 s.db.prepare('INSERT INTO admin_drafts VALUES(?,?)').run('1',JSON.stringify({step,editing:true,p:{name:'Unpublished draft'}}));s.db.prepare('INSERT INTO admin_drafts VALUES(?,?)').run('2',JSON.stringify({step:'name'}));
 let adminCalls=0;const handled=await adminUpdate({message:{from:{id:1},chat:{id:1,type:'private'},text:'/start'}},s,async()=>{adminCalls++},'1','BloomOrderDemoBot');
 assert.equal(handled,false);assert.equal(adminCalls,0);assert.equal(s.db.prepare('SELECT * FROM admin_drafts WHERE owner=?').get('1'),undefined);assert.ok(s.db.prepare('SELECT * FROM admin_drafts WHERE owner=?').get('2'));assert.deepEqual(snapshots(s),before);
 const calls=[];await openView(s,async(m,p)=>{calls.push(m);return {message_id:200}},1,1,'home');assert.ok(calls.includes('sendWidget'));assert.deepEqual(snapshots(s),before);s.close();
 });
}
for(const text of ['/catalog','/cart','/help','/builder','/id','/start payload','/start@BloomOrderDemoBot',' /catalog@bloomorderdemobot '])test('customer command bypasses a draft: '+text,async()=>{
 const s=new ShopStore(':memory:');s.db.prepare('INSERT INTO admin_drafts VALUES(?,?)').run('1',JSON.stringify({step:'rosePrice',kind:'color',id:'red'}));assert.equal(await adminUpdate({message:{from:{id:1},chat:{id:1,type:'private'},text}},s,async()=>{throw Error('Unexpected admin API call')},'1','BloomOrderDemoBot'),false);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM admin_drafts').get().n,0);s.close();
});
test('exit never clears another user draft or a command addressed to another bot',async()=>{
 const s=new ShopStore(':memory:');const draft=JSON.stringify({step:'publish',p:{name:'Draft'}});s.db.prepare('INSERT INTO admin_drafts VALUES(?,?)').run('1',draft);
 assert.equal(await adminUpdate({message:{from:{id:2},chat:{id:2,type:'private'},text:'/start'}},s,async()=>{},'1','BloomOrderDemoBot'),false);assert.equal(s.db.prepare('SELECT body FROM admin_drafts WHERE owner=?').get('1').body,draft);
 await adminUpdate({message:{from:{id:1},chat:{id:1,type:'private'},text:'/start@AnotherBot'}},s,async()=>{},'1','BloomOrderDemoBot');assert.equal(s.db.prepare('SELECT body FROM admin_drafts WHERE owner=?').get('1').body,draft);s.close();
});
test('consecutive identical commands reuse their fresh reply',async()=>{
 const s=new ShopStore(':memory:');for(const p of s.products())s.saveProduct({...p,photo:'file-'+p.id});const calls=[];let message=200;const api=async(m,p)=>{calls.push([m,p]);return {message_id:++message}};
 await openView(s,api,1,1,'home');await openView(s,api,1,1,'home');assert.equal(calls.filter(c=>c[0]==='sendWidget').length,1);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM views WHERE active=1').get().n,1);
 await openView(s,api,1,1,'catalog');await openView(s,api,1,1,'catalog');assert.equal(calls.filter(c=>c[0]==='sendPhoto').length,1);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM cards WHERE active=1').get().n,1);assert.equal(calls.filter(c=>c[0].startsWith('editMessage')).length,0);s.close();
});
