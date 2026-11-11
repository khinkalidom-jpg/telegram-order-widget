import {randomUUID} from 'node:crypto';
import {adminText as t,money} from './config.js';
export function authorized(from,id){return !!id&&/^\d+$/.test(String(id))&&String(from?.id)===String(id)}
export function priceValue(text){if(!/^\d{1,6}(\.\d{1,2})?$/.test(text))throw Error(t.invalid);const [a,b='']=text.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(n<100||n>10000000)throw Error(t.invalid);return n}
export async function adminUpdate(u,store,api,admin){const cb=u.callback_query,m=u.message,from=cb?.from||m?.from,chat=cb?.message?.chat||m?.chat;
 const existing=from&&store.db.prepare('SELECT body FROM admin_drafts WHERE owner=?').get(String(from.id));
 if(!(cb?.data?.startsWith('adm:')||m?.text==='/admin'||m?.text==='/cancel'||existing))return false;
 if(!authorized(from,admin)||chat?.type!=='private'){if(cb)await api('answerCallbackQuery',{callback_query_id:cb.id,text:t.denied});return true}
 const owner=String(from.id),say=(text,buttons=[])=>api('sendMessage',{chat_id:chat.id,text,reply_markup:{inline_keyboard:buttons.map(row=>row.map(([text,data])=>({text,callback_data:'adm:'+data})))}});
 const save=d=>store.db.prepare('INSERT INTO admin_drafts VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET body=excluded.body').run(owner,JSON.stringify(d));
 const clear=()=>store.db.prepare('DELETE FROM admin_drafts WHERE owner=?').run(owner);
 const preview=async d=>{await api('sendPhoto',{chat_id:chat.id,photo:d.p.photo,caption:t.preview+'\n'+d.p.name+'\n'+d.p.description+'\n'+money(d.p.price),reply_markup:{inline_keyboard:[[{text:t.publish,callback_data:'adm:publish'},{text:t.cancel,callback_data:'adm:cancel'}]]}})};
 if(cb)await api('answerCallbackQuery',{callback_query_id:cb.id});
 let d=existing?JSON.parse(existing.body):null;const action=cb?.data.slice(4);
 if(action==='cancel'||m?.text==='/cancel'){clear();await say(t.cancelled);return true}
 if(m?.text==='/admin'){await say(t.menu,[[[t.add,'add']],...store.products().map(p=>[[p.name,'item:'+p.id]])]);return true}
 if(action==='add'){d={step:'name',p:{id:randomUUID().replaceAll('-','').slice(0,16),available:1}};save(d);await say(t.name);return true}
 if(action?.startsWith('item:')){const p=store.product(action.slice(5));if(p)await say(p.name+' · '+money(p.price),[[[t.editName,'edit:name:'+p.id],[t.editDescription,'edit:description:'+p.id]],[[t.editPrice,'edit:price:'+p.id],[t.editPhoto,'edit:photo:'+p.id]],[[p.available?t.hide:t.show,'toggle:'+p.id]]]);return true}
 if(action?.startsWith('toggle:')){const p=store.product(action.slice(7));if(p){p.available=!p.available;if(!p.photo){await say(t.photo);return true}store.saveProduct(p);await say(t.saved)}return true}
 if(action?.startsWith('edit:')){const [,field,id]=action.split(':');if(!['name','description','price','photo'].includes(field))return true;const p=store.product(id);if(p){save({step:field,p,editing:true});await say(t[field])}return true}
 if(action==='publish'){if(d?.step==='publish'){try{store.saveProduct(d.p);clear();await say(t.saved)}catch{await say(t.invalid)}}return true}
 if(!d||!m)return true;
 try{if(d.step==='photo'){const photo=m.photo?.at(-1);if(!photo?.file_id||photo.width<100||photo.height<100)throw Error();d.p.photo=photo.file_id}else if(d.step==='price')d.p.price=priceValue(m.text||'');else if(['name','description'].includes(d.step)){const v=m.text?.trim();if(!v||v.length>(d.step==='name'?48:120))throw Error();d.p[d.step]=v}else return true;
 const steps=['name','description','price','photo','publish'];d.step=d.editing?'publish':steps[steps.indexOf(d.step)+1];if(d.step==='publish'&&!d.p.photo)d.step='photo';save(d);if(d.step==='publish')await preview(d);else await say(t[d.step]);
 }catch{await say(t.invalid)}return true;
}
