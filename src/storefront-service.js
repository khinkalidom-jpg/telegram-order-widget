import {bounded} from './shop-store.js';
import {storefrontHTML} from './storefront.js';
import {checkSizes} from './sizes.js';
import {ui} from './config.js';
const html=storefrontHTML();checkSizes(html);
export async function openView(store,api,owner,chat,screen){const s=store.open(owner,chat,screen);const p=store.screen(s).p;const product=p&&store.product(p.id);const photo=product?.photo?await api('sendPhoto',{chat_id:chat,photo:product.photo}):null;const sent=await api('sendWidget',{chat_id:chat,html,allow_queries:true,chat_data:bounded(store.screen(s)),caption:ui.demo});store.bind(s,sent.message_id,photo?.message_id);return s}
export async function storefrontQuery(q,store,api){let result;try{result=store.action(q)}catch(e){result={error:e.message}}await api('answerWidgetQuery',{widget_query_id:q.id,data:bounded(result)});}
export async function syncViews(store,api){for(const v of store.db.prepare('SELECT * FROM views WHERE dirty=1 LIMIT 10').all()){try{const s=store.session(v.session),d=store.screen(s),p=d.p&&store.product(d.p.id);let photo=v.photo;
 if(p?.photo){if(photo){await api('editMessageMedia',{chat_id:v.chat,message_id:photo,media:{type:'photo',media:p.photo}}).catch(e=>{if(!e.notModified)throw e})}else{const sent=await api('sendPhoto',{chat_id:v.chat,photo:p.photo});photo=sent.message_id;store.db.prepare('UPDATE views SET photo=? WHERE chat=? AND message=?').run(photo,v.chat,v.message);const file=sent.photo?.at(-1)?.file_id;if(file&&file!==p.photo)store.db.prepare('UPDATE products SET photo=? WHERE id=?').run(file,p.id)}}
 else if(photo){await api('deleteMessage',{chat_id:v.chat,message_id:photo});store.db.prepare('UPDATE views SET photo=NULL WHERE chat=? AND message=?').run(v.chat,v.message)}
 await api('editMessageWidgetData',{chat_id:v.chat,message_id:v.message,chat_data:bounded(d)}).catch(e=>{if(!e.notModified)throw e});
 if(store.session(s.id).rev===s.rev)store.db.prepare('UPDATE views SET dirty=0 WHERE chat=? AND message=?').run(v.chat,v.message);
 }catch(e){console.warn(`Storefront delivery pending (${e.code||'internal'}).`)}}}
