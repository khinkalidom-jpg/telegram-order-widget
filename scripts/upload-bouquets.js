// Explicit one-time operation: uploads generated demo images; never runs at startup.
import {readFileSync} from 'node:fs';
import {ShopStore} from '../src/shop-store.js';
import {createHash} from 'node:crypto';
const token=process.env.BOT_TOKEN,chat=process.env.ADMIN_CHAT_ID;
if(!token||!chat)throw Error('BOT_TOKEN and ADMIN_CHAT_ID are required.');
const store=new ShopStore(process.env.DATABASE_PATH||'./data/bloom.sqlite');
const fingerprint=()=>createHash('sha256').update(JSON.stringify(store.db.prepare('SELECT * FROM orders ORDER BY id').all())).digest('hex');
const before=fingerprint();
try{
 const manifest=JSON.parse(readFileSync(new URL('../assets/bouquets/manifest.json',import.meta.url)));
 for(const item of manifest){const p=store.product(item.id);if(!p)throw Error('Existing bouquet not found.');
 const form=new FormData();form.set('chat_id',chat);form.set('photo',new Blob([readFileSync(new URL('../assets/bouquets/'+item.file,import.meta.url))],{type:'image/png'}),item.file);form.set('caption',item.name+' · Generated demo imagery');
 let response;try{response=await fetch(`https://api.telegram.org/bot${token}/sendPhoto`,{method:'POST',body:form,signal:AbortSignal.timeout(60000)})}catch{throw Error('Photo transport failed.')}
 const data=await response.json();console.log(JSON.stringify({product:item.id,http_status:response.status,ok:data.ok}));
 if(!response.ok||!data.ok||!data.result?.photo?.length)throw Error('Telegram photo upload failed.');
 store.saveProduct({...p,name:item.name,description:item.description,photo:data.result.photo.at(-1).file_id});
 }
 if(before!==fingerprint())throw Error('Order preservation check failed.');
 console.log('Four products updated; prices and historical orders preserved.');
}finally{store.close()}
