import {timeConfig} from './order-time.js';
import {adminWords,words,formatMoney} from './i18n.js';
import {randomUUID} from 'node:crypto';
import {adminText as defaults,money} from './config.js';
export function authorized(from,id){return !!id&&/^[1-9]\d*$/.test(String(id))&&Number.isSafeInteger(Number(id))&&String(from?.id)===String(id)}
export function priceValue(text){if(!/^\d{1,6}(\.\d{1,2})?$/.test(text))throw Error(defaults.invalid);const [a,b='']=text.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(n<100||n>10000000)throw Error(defaults.invalid);return n}
export async function adminUpdate(u,store,api,admin,botUsername){const cb=u.callback_query,m=u.message,from=cb?.from||m?.from,chat=cb?.message?.chat||m?.chat;
 // Customer navigation leaves only this sender's unfinished input behind.
 // Published products and builder settings are never changed by this exit.
 const [command,mention]=(m?.text?.trim().split(/\s+/)[0]||'').split('@');
 if(m&&chat?.type==='private'&&from?.id&&['/start','/catalog','/cart','/help','/builder','/id'].includes(command)&&(!mention||mention.toLowerCase()===botUsername?.toLowerCase())){
  store.db.prepare('DELETE FROM admin_drafts WHERE owner=?').run(String(from.id));
  return false;
 }
 const l=store.lang(from?.id),t={...defaults,...adminWords[l]},w=words[l];
 const existing=from&&store.db.prepare('SELECT body FROM admin_drafts WHERE owner=?').get(String(from.id));
 if(!(cb?.data?.startsWith('order:')||cb?.data?.startsWith('adm:')||m?.text==='/admin'||m?.text==='/cancel'||existing))return false;
 if(!authorized(from,admin)||chat?.type!=='private'){if(cb)await api('answerCallbackQuery',{callback_query_id:cb.id,text:t.denied});return true}
 if(cb?.data?.startsWith('order:')){
  const [,status,id]=cb.data.split(':');let changed=false;
  if(['accepted','ready','cancelled'].includes(status)&&/^\d+$/.test(id)){
   store.db.exec('BEGIN IMMEDIATE');try{
    const order=store.db.prepare('SELECT id FROM orders WHERE id=?').get(Number(id));
    const current=store.db.prepare('SELECT status FROM order_status WHERE order_id=?').get(Number(id))?.status||'pending';
    if(order&&((current==='pending'&&['accepted','cancelled'].includes(status))||(current==='accepted'&&['ready','cancelled'].includes(status)))){
     store.db.prepare('INSERT INTO order_status VALUES(?,?) ON CONFLICT(order_id) DO UPDATE SET status=excluded.status').run(Number(id),status);
     store.db.prepare('INSERT OR IGNORE INTO jobs(order_id,kind) VALUES(?,?)').run(Number(id),'status:'+status);changed=true;
    }store.db.exec('COMMIT');
   }catch(e){store.db.exec('ROLLBACK');throw e}
  }
  await api('answerCallbackQuery',{callback_query_id:cb.id,text:changed?t.saved:t.invalid});return true;
 }
 const owner=String(from.id),say=(text,buttons=[])=>api('sendMessage',{chat_id:chat.id,text,reply_markup:{inline_keyboard:buttons.map(row=>row.map(([text,data])=>({text,callback_data:'adm:'+data})))}});
 const save=d=>store.db.prepare('INSERT INTO admin_drafts VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET body=excluded.body').run(owner,JSON.stringify(d));
 const clear=()=>store.db.prepare('DELETE FROM admin_drafts WHERE owner=?').run(owner);
 const preview=async d=>{await api('sendPhoto',{chat_id:chat.id,photo:d.p.photo,caption:t.preview+'\n'+d.p.name+'\n'+d.p.description+'\n'+money(d.p.price),reply_markup:{inline_keyboard:[[{text:t.publish,callback_data:'adm:publish'},{text:t.cancel,callback_data:'adm:cancel'}]]}})};
 if(cb)await api('answerCallbackQuery',{callback_query_id:cb.id});
 let d=existing?JSON.parse(existing.body):null;const action=cb?.data.slice(4);
 if(action==='cancel'||m?.text==='/cancel'){clear();await say(t.cancelled);return true}
 if(m?.text==='/admin'){await say(t.menu,[[[t.add,'add']],[[w.settings,'roses']],[[w.when,'timeConfig']],...store.products().map(p=>[[p.name,'item:'+p.id]])]);return true}
 if(action==='timeConfig'){const cfg=timeConfig(store.db);await say(w.when+' · Asia/Tbilisi',[[[w.lead+': '+cfg.lead,'timeCfg:lead']],[[w.open+': '+cfg.open,'timeCfg:open']],[[w.close+': '+cfg.close,'timeCfg:close']]]);return true}
 if(action?.startsWith('timeCfg:')){const field=action.slice(8);if(['lead','open','close'].includes(field)){save({step:'timeConfig',field});await say(w[field])}return true}
 if(action==='roses'){const cfg=store.builder();await say(w.settings+'\n'+w.notSet+': '+[...cfg.colors,...cfg.wraps].filter(x=>x.price===null).map(x=>w[x.id]).join(', '),[...cfg.colors.map(p=>[[w[p.id]+' · '+(p.price===null?w.notSet:formatMoney(p.price)),'rose:color:'+p.id],[p.available?t.hide:t.show,'roseToggle:color:'+p.id]]),...cfg.wraps.map(p=>[[w[p.id]+' · '+(p.price===null?w.notSet:formatMoney(p.price)),'rose:wrap:'+p.id],[p.available?t.hide:t.show,'roseToggle:wrap:'+p.id]]),[[w.min+' '+cfg.min,'bounds:min'],[w.max+' '+cfg.max,'bounds:max']]]);return true}
 if(action?.startsWith('roseToggle:')){const [,kind,id]=action.split(':');const p=store.db.prepare('SELECT * FROM rose_options WHERE kind=? AND id=?').get(kind,id);if(p?.price!==null&&p){store.setRose(kind,id,p.price,!p.available);await say(t.saved)}else await say(w.notSet);return true}
 if(action?.startsWith('rose:')){const [,kind,id]=action.split(':');if(!store.db.prepare('SELECT 1 FROM rose_options WHERE kind=? AND id=?').get(kind,id))return true;save({step:'rosePrice',kind,id});await say((kind==='color'?w.priceStem:w.priceWrap)+' (GEL)'+(kind==='wrap'?' · 0 = '+w.included:''),[[[t.cancel,'cancel']]]);return true}
 if(action?.startsWith('bounds:')){const field=action.slice(7);if(!['min','max'].includes(field))return true;save({step:'bounds',field});await say(w[field]+' (1–1000)');return true}
 if(action?.startsWith('translations:')){const id=action.slice(13);if(store.product(id))await say(w.translations,['ru','ka','en'].map(l=>[[l+' · '+w.name,'tr:'+id+':'+l+':name'],[l+' · '+w.description,'tr:'+id+':'+l+':description']]));return true}
 if(action?.startsWith('tr:')){const [,id,lang,field]=action.split(':');if(store.product(id)&&words[lang]&&['name','description'].includes(field)){save({step:'translation',id,lang,field});await say(t[field])}return true}
 if(action==='add'){d={step:'name',p:{id:randomUUID().replaceAll('-','').slice(0,16),available:1}};save(d);await say(t.name);return true}
 if(action?.startsWith('item:')){const p=store.product(action.slice(5));if(p)await say(p.name+' · '+money(p.price),[[[t.editName,'edit:name:'+p.id],[t.editDescription,'edit:description:'+p.id]],[[t.editPrice,'edit:price:'+p.id],[t.editPhoto,'edit:photo:'+p.id]],[[p.available?t.hide:t.show,'toggle:'+p.id]],[[w.translations,'translations:'+p.id]]]);return true}
 if(action?.startsWith('toggle:')){const p=store.product(action.slice(7));if(p){p.available=!p.available;if(!p.photo){await say(t.photo);return true}store.saveProduct(p);await say(t.saved)}return true}
 if(action?.startsWith('edit:')){const [,field,id]=action.split(':');if(!['name','description','price','photo'].includes(field))return true;const p=store.product(id);if(p){save({step:field,p,editing:true});await say(t[field])}return true}
 if(action==='publish'){if(d?.step==='publish'){try{store.saveProduct(d.p);clear();await say(t.saved)}catch{await say(t.invalid)}}return true}
 if(!d||!m)return true;
 try{if(d.step==='rosePrice'){const value=m.text?.trim();let price;if(d.kind==='wrap'&&/^(0|0\.0{1,2})$/.test(value))price=0;else{if(!/^\d{1,6}(\.\d{1,2})?$/.test(value))throw Error();const [a,b='']=value.split('.');price=Number(a)*100+Number(b.padEnd(2,'0'))}store.setRose(d.kind,d.id,price);clear();await say(t.saved);return true}
 if(d.step==='timeConfig'){if(!/^\d{1,4}$/.test(m.text||''))throw Error();const cfg=JSON.parse(store.db.prepare("SELECT value FROM metadata WHERE key='order_time_config'").get()?.value||'{"lead":60,"open":9,"close":20}');cfg[d.field]=Number(m.text);if(cfg.lead>1440||cfg.open<0||cfg.close>24||cfg.open>=cfg.close)throw Error();store.db.prepare("INSERT INTO metadata VALUES('order_time_config',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(cfg));clear();await say(t.saved);return true}
 if(d.step==='bounds'){if(!/^\d{1,4}$/.test(m.text||''))throw Error();const cfg=store.builder();store.setLimits(d.field==='min'?Number(m.text):cfg.min,d.field==='max'?Number(m.text):cfg.max);clear();await say(t.saved);return true}
 if(d.step==='translation'){store.translate(d.id,d.lang,d.field,m.text||'');clear();await say(t.saved);return true}
 if(d.step==='photo'){const photo=m.photo?.at(-1);if(!photo?.file_id||photo.width<100||photo.height<100)throw Error();d.p.photo=photo.file_id}else if(d.step==='price')d.p.price=priceValue(m.text||'');else if(['name','description'].includes(d.step)){const v=m.text?.trim();if(!v||v.length>(d.step==='name'?48:120))throw Error();d.p[d.step]=v}else return true;
 const steps=['name','description','price','photo','publish'];d.step=d.editing?'publish':steps[steps.indexOf(d.step)+1];if(d.step==='publish'&&!d.p.photo)d.step='photo';save(d);if(d.step==='publish')await preview(d);else await say(t[d.step]);
 }catch{await say(t.invalid)}return true;
}
