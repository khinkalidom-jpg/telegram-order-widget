import {bounded} from './shop-store.js';
import {storefrontHTML} from './storefront.js';
import {checkSizes} from './sizes.js';
import {words,formatMoney,errorText,commands} from './i18n.js';
const locks=new Map();
export async function serial(key,fn){const previous=locks.get(key)||Promise.resolve();const job=previous.catch(()=>{}).then(fn);locks.set(key,job);try{return await job}finally{if(locks.get(key)===job)locks.delete(key)}}
export function cardPayload(store,s){const d=store.screen(s),t=words[d.l];if(!d.p)return null;const p=store.product(d.p.id);if(!p?.photo)return null;
 const cb=(label,a,arg=d.p.id)=>{const data=JSON.stringify(['c',s.id,s.rev,a,arg]);if(Buffer.byteLength(data)>64)throw Error('Callback exceeds 64 bytes');return {text:label,callback_data:data}};
 const keyboard=[[cb('−','less'),cb(String(d.qty),'noop'),cb('+','more')],[cb(d.error===t.added?t.added:t.add,'bag')],[cb(t.prev,'prev'),cb(`${d.i+1} / ${d.n}`,'noop'),cb(t.next,'next')],[cb(t.cart+' · '+d.count,'cart'),cb(t.home,'home')]];
 return {media:{type:'photo',media:p.photo,caption:`${d.p.name}\n${formatMoney(p.price)} · ${t.per}\n${t.demo}`},reply_markup:{inline_keyboard:keyboard},product:p.id};
}
async function menu(store,api,s){const l=store.lang(s.owner);const cmds=commands(l);if(process.env.ADMIN_USER_ID&&String(process.env.ADMIN_USER_ID)===s.owner)cmds.push({command:'admin',description:words[l].admin},{command:'cancel',description:words[l].cancel});await api('setMyCommands',{scope:{type:'chat',chat_id:s.chat},commands:cmds})}
export async function renderSession(store,api,id,fresh=false){const s=store.session(id);if(!s)return;const l=store.lang(s.owner),t=words[l];
 if(s.screen==='catalog'){
 const payload=cardPayload(store,s);if(!payload){const sent=await api('sendMessage',{chat_id:s.chat,text:t.unavailable});store.db.prepare('UPDATE ui_state SET dirty=0 WHERE session=?').run(id);return sent}
 const card=!fresh&&store.db.prepare('SELECT * FROM cards WHERE session=? ORDER BY message DESC LIMIT 1').get(id);
 if(card){await api('editMessageMedia',{chat_id:s.chat,message_id:card.message,media:payload.media,reply_markup:payload.reply_markup}).catch(e=>{if(!e.notModified)throw e});store.db.prepare('UPDATE cards SET product=?,rev=?,active=1 WHERE chat=? AND message=?').run(payload.product,s.rev,s.chat,card.message)}
 else{const sent=await api('sendPhoto',{chat_id:s.chat,photo:payload.media.media,caption:payload.media.caption,reply_markup:payload.reply_markup});store.db.prepare('UPDATE cards SET active=0 WHERE session=?').run(id);store.db.prepare('INSERT INTO cards VALUES(?,?,?,?,?,1)').run(s.chat,sent.message_id,id,payload.product,s.rev)}
 store.db.prepare('UPDATE views SET active=0 WHERE session=?').run(id);
 }else{
 const blocks=store.screens(s);let views=store.db.prepare('SELECT * FROM views WHERE session=? AND active=1 ORDER BY block').all(id);
 const reusable=!fresh&&views.length===blocks.length&&views.every((v,i)=>v.screen===s.screen&&v.lang===l&&v.block===i);
 if(!reusable){const html=storefrontHTML(l);checkSizes(html);const created=[];
 for(let i=0;i<blocks.length;i++){const sent=await api('sendWidget',{chat_id:s.chat,html,allow_queries:true,chat_data:bounded(blocks[i]),caption:i===blocks.length-1?t.demo:'BLOOM'});created.push(sent.message_id)}
 store.db.prepare('UPDATE views SET active=0 WHERE session=?').run(id);created.forEach((message,i)=>store.bind(s,message,null,i));
 }else for(const v of views)await api('editMessageWidgetData',{chat_id:s.chat,message_id:v.message,chat_data:bounded(blocks[v.block])}).catch(e=>{if(!e.notModified)throw e});
 store.db.prepare('UPDATE cards SET active=0 WHERE session=?').run(id);
 }
 if(store.session(id).rev===s.rev)store.db.prepare('UPDATE ui_state SET dirty=0 WHERE session=?').run(id);
}
export async function openView(store,api,owner,chat,screen,from){if(from)store.observe(from);const s=store.open(owner,chat,screen);await serial(String(s.id),()=>renderSession(store,api,s.id,true));await menu(store,api,s);return s}
export async function cardCallback(q,store,api){if(!q.data?.startsWith('["c",'))return false;let a;try{a=JSON.parse(q.data)}catch{return false}const [,id,rev,act,product]=a;await serial(String(id),async()=>{
 const s=store.session(id),l=store.lang(q.from.id);try{
 const c=store.db.prepare('SELECT * FROM cards WHERE chat=? AND message=?').get(String(q.message?.chat?.id),q.message?.message_id);
 if(!s||!c||c.session!==id||s.owner!==String(q.from.id))throw {code:'forbidden'};
 if(!c.active||s.screen!=='catalog'||rev!==s.rev||rev!==c.rev||product!==c.product||store.screen(s).p?.id!==product)throw {code:'stale'};
 const selection=s.selection||1;let action=act,arg;
 if(act==='less'||act==='more'){action='quantity';arg=Math.max(1,Math.min(20,selection+(act==='more'?1:-1)))}
 else if(act==='bag')arg=[product,selection];else if(!['prev','next','home','cart','noop'].includes(act))throw {code:'invalid'};
 if(act!=='noop')store.apply(id,s.owner,action,rev,arg);
 await api('answerCallbackQuery',{callback_query_id:q.id,text:act==='bag'?words[l].added:undefined});
 if(act!=='noop')await renderSession(store,api,id);
 }catch(e){await api('answerCallbackQuery',{callback_query_id:q.id,text:errorText(e,l)}).catch(()=>{});}
 });return true}
export async function storefrontQuery(q,store,api){let s;try{s=store.resolve(q)}catch(e){await api('answerWidgetQuery',{widget_query_id:q.id,data:bounded({error:errorText(e,store.lang(q.from.id))})});return}
 if(!s){await api('answerWidgetQuery',{widget_query_id:q.id,data:bounded({error:words[store.lang(q.from.id)].stale})});return}
 await serial(String(s.id),async()=>{try{
 const before=store.lang(s.owner);store.action(q);const v=store.db.prepare('SELECT session,block FROM views WHERE chat=? AND message=?').get(String(q.chat.id),q.message_id);const now=store.session(v.session);
 // The worker delivers changed screens and continuation blocks after acknowledging the query.
 await api('answerWidgetQuery',{widget_query_id:q.id,data:bounded({ok:true})});
 if(before!==store.lang(s.owner))await menu(store,api,now);
 }catch(e){await api('answerWidgetQuery',{widget_query_id:q.id,data:bounded({error:errorText(e,store.lang(s.owner))})})}})}
export async function syncViews(store,api){for(const row of store.db.prepare('SELECT session FROM ui_state WHERE dirty=1 LIMIT 10').all())await serial(String(row.session),()=>renderSession(store,api,row.session)).catch(e=>{console.warn(`Storefront delivery pending (${e.code||'internal'}).`)})}
