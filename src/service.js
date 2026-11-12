import {desiredTimeText} from './order-time.js';
import {words,language} from './i18n.js';
import { money } from './config.js';
export const receipt = order => ({ id: order.id, items: order.items, total: order.total });
export async function handleQuery(query, store, api) {
  let result;
  try {
    if (!query.from?.id || !query.chat?.id || !Number.isInteger(query.message_id) || query.type?.type !== 'data') throw new Error('Unsupported widget request.');
    result = receipt(store.place(query.chat.id, query.message_id, query.from.id, query.data));
  } catch(e) { result = { error: e.message.startsWith('SQL') ? 'Please retry.' : e.message }; }
  // No notification or edit before this deadline-sensitive response.
  const deadline = Date.now() + 11000;
  for (let attempt=0; attempt<2; attempt++) {
    try { await api('answerWidgetQuery', {widget_query_id:query.id, data:JSON.stringify(result)}, Math.max(1,Math.min(5000,deadline-Date.now()))); return; }
    catch(e) {
      const wait = e.retryAfter ? e.retryAfter*1000 : 200;
      if (attempt || Date.now()+wait+1000>=deadline) throw e;
      await new Promise(r=>setTimeout(r,wait));
    }
  }
}
export async function drainJobs(store, api, admin) {
  for (const job of store.due()) {
    try {
      const body = JSON.parse(job.body);
      if(job.kind==='widget') await api('editMessageWidgetData',{chat_id:job.chat,message_id:job.message,chat_data:JSON.stringify(receipt({id:job.order_id,...body}))});
      else if(job.kind.startsWith('status:')){
        if(job.kind!=='status:accepted'&&store.db.prepare("SELECT 1 FROM jobs WHERE order_id=? AND kind='status:accepted' AND done=0").get(job.order_id))throw Error('Previous status delivery pending');
        const l=language(body.customer?.language||body.customer?.lang||'en'),w=words[l],status=job.kind.slice(7);
        await api('sendMessage',{chat_id:job.chat,text:`BLOOM #${job.order_id} · ${w[{accepted:'accepted',ready:'readyMessage',cancelled:'cancelledMessage'}[status]]}`});
      }else {
        if(!admin) throw new Error('Admin not configured');
        const customer=body.customer||{id:job.owner};
        const w=words[store.lang?store.lang(admin):'ru'];
        const lines=[`🌷 ${w.newOrder} · ADMIN`,`${w.order}${job.order_id}`,...(customer.name?[customer.name]:[]),...(customer.username?['@'+customer.username]:[]),`ID: ${customer.id}`,...[[w.catalog,body.items.filter(p=>!p.params)],[w.builder,body.items.filter(p=>p.params)]].flatMap(([heading,items])=>items.length?[heading,...items.map(p=>`${p.quantity} × ${p.names?.[store.lang?.(admin)]||p.name}${p.params?` (${p.params.stems}; ${w[p.params.color]}; ${w[p.params.wrap]})`:''} — ${money(p.quantity*p.price)}`)]:[]),`${w.when}: ${desiredTimeText(body.desiredTime,w)}`,`${w.total}: ${money(body.total)}`,w.pending,w.demo];
        const reply_markup={inline_keyboard:[[{text:w.accept,callback_data:'order:accepted:'+job.order_id},{text:w.readyStatus,callback_data:'order:ready:'+job.order_id}],[{text:w.cancelStatus,callback_data:'order:cancelled:'+job.order_id},{text:w.contact,url:customer.username?'https://t.me/'+customer.username:'tg://user?id='+customer.id}]]};
        const chunks=[];let text='';for(const line of lines){if((text+'\n'+line).length>3500){chunks.push(text);text=''}text+=(text?'\n':'')+line}if(text)chunks.push(text);
        store.db.exec('CREATE TABLE IF NOT EXISTS notification_parts(order_id INTEGER PRIMARY KEY,next_part INTEGER DEFAULT 0)');
        const start=store.db.prepare('SELECT next_part FROM notification_parts WHERE order_id=?').get(job.order_id)?.next_part||0;
        for(let i=start;i<chunks.length;i++){await api('sendMessage',{chat_id:admin,text:chunks[i],...(i===chunks.length-1?{reply_markup}:{})});store.db.prepare('INSERT INTO notification_parts VALUES(?,?) ON CONFLICT(order_id) DO UPDATE SET next_part=excluded.next_part').run(job.order_id,i+1)}
      }
      store.done(job);
    } catch(e) {
      const reason=String(e.code||'local')+':'+(e.reason||(e.message==='Admin not configured'?'ADMIN_CHAT_ID missing':'transport/internal'));
      store.retry(job, Math.max((e.retryAfter||0)*1000, Math.min(300000,1000*2**Math.min(job.attempts,9))),reason);
      console.warn(`Pending ${job.kind} delivery for order #${job.order_id}; retry scheduled (${reason}).`);
    }
  }
}
