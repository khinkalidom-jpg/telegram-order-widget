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
        await api('sendMessage',{chat_id:admin,text:`DEMO · BLOOM #${job.order_id}\nCustomer ID: ${job.owner}\n${body.items.map(p=>`${p.quantity} × ${p.name} — ${money(p.quantity*p.price)}`).join('\n')}\nTotal: ${money(body.total)}\nNo payment or delivery.`});
      }
      store.done(job);
    } catch(e) {
      store.retry(job, Math.max((e.retryAfter||0)*1000, Math.min(300000,1000*2**Math.min(job.attempts,9))));
      console.warn(`Pending ${job.kind} delivery for order #${job.order_id}; retry scheduled.`);
    }
  }
}
