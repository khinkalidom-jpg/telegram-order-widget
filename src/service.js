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
      else {
        if(!admin) throw new Error('Admin not configured');
        const customer=body.customer||{id:job.owner};
        const lines=[`DEMO · BLOOM #${job.order_id}`,...(customer.name?[customer.name]:[]),...(customer.username?['@'+customer.username]:[]),`Customer ID: ${customer.id}`,...body.items.map(p=>`${p.quantity} × ${p.name}${p.params?` (${p.params.stems} stems; ${p.params.color}; ${p.params.wrap})`:''} — ${money(p.quantity*p.price)}`),`Total: ${money(body.total)}`,'No payment or delivery.'];
        const chunks=[];let text='';for(const line of lines){if((text+'\n'+line).length>3500){chunks.push(text);text=''}text+=(text?'\n':'')+line}if(text)chunks.push(text);
        store.db.exec('CREATE TABLE IF NOT EXISTS notification_parts(order_id INTEGER PRIMARY KEY,next_part INTEGER DEFAULT 0)');
        const start=store.db.prepare('SELECT next_part FROM notification_parts WHERE order_id=?').get(job.order_id)?.next_part||0;
        for(let i=start;i<chunks.length;i++){await api('sendMessage',{chat_id:admin,text:chunks[i]});store.db.prepare('INSERT INTO notification_parts VALUES(?,?) ON CONFLICT(order_id) DO UPDATE SET next_part=excluded.next_part').run(job.order_id,i+1)}
      }
      store.done(job);
    } catch(e) {
      store.retry(job, Math.max((e.retryAfter||0)*1000, Math.min(300000,1000*2**Math.min(job.attempts,9))));
      console.warn(`Pending ${job.kind} delivery for order #${job.order_id}; retry scheduled.`);
    }
  }
}
