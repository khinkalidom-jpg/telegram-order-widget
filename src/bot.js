import { Store } from './store.js';
import { createApi } from './api.js';
import { handleQuery, drainJobs } from './service.js';
import { widgetHTML } from './widget.js';
import { checkSizes } from './sizes.js';
import { shop } from './config.js';
const token=process.env.BOT_TOKEN, admin=process.env.ADMIN_CHAT_ID;
if(!token){console.error('Не задан BOT_TOKEN. Заполните .env; превью: npm run preview');process.exit(1)}
if(admin && !/^-?\d+$/.test(admin)){console.error('ADMIN_CHAT_ID должен быть числовым ID чата.');process.exit(1)}
if(!admin)console.warn('ADMIN_CHAT_ID не задан: уведомления сохраняются в очереди до настройки.');
const store=new Store(process.env.DATABASE_PATH||'./data/bloom.sqlite'),api=createApi(token),html=widgetHTML();
checkSizes(html);
let running=true,working=false;
process.on('SIGINT',()=>{running=false});process.on('SIGTERM',()=>{running=false});
const worker=setInterval(async()=>{if(working)return;working=true;try{await drainJobs(store,api,admin)}finally{working=false}},1000);
try {
  const me=await api('getMe',{});
  const webhook=await api('getWebhookInfo',{});
  if(webhook.url)throw new Error('У бота настроен webhook. Отключите его перед long polling.');
  console.log(`BLOOM bot @${me.username} connected.`);
  while(running){
    try {
      const updates=await api('getUpdates',{offset:store.offset(),timeout:25,limit:10,allowed_updates:['message','widget_query']},30000);
      // Answer requests first so commands in the same batch do not delay them.
      await Promise.all(updates.filter(u=>u.widget_query).map(async u=> {
        try{await handleQuery(u.widget_query,store,api)}catch(e){console.warn(`Widget answer failed (${e.code||'internal'}); order remains durable.`)}
      }));
      for(const u of updates){
        const m=u.message;
        if(m?.text){
          const [command]=m.text.trim().split(/\s/),[name,mention]=command.split('@');
          if(!mention||mention.toLowerCase()===me.username.toLowerCase()){
            if(name==='/id')await api('sendMessage',{chat_id:m.chat.id,text:`Chat ID: ${m.chat.id}`});
            else if(['/start','/catalog'].includes(name)){
              if(m.chat.type!=='private')await api('sendMessage',{chat_id:m.chat.id,text:'Please open a private chat with the bot to place a demo order.'});
              else{
                const sent=await api('sendWidget',{chat_id:m.chat.id,html,width:0,height:0,allow_queries:true,chat_data:'{}',caption:shop.intro+'\n'+shop.notice});
                store.register(m.chat.id,sent.message_id,m.from.id);
              }
            }
          }
        }
      }
      if(updates.length)store.offset(updates.at(-1).update_id+1);
    }catch(e){console.warn(`Polling/command error (${e.code||'internal'}). Retrying.`);await new Promise(r=>setTimeout(r,Math.max(1000,(e.retryAfter||0)*1000)))}
  }
}catch(e){console.error(e.code?`Telegram connection failed (${e.code}).`:e.message);process.exitCode=1}
finally{clearInterval(worker);while(working)await new Promise(r=>setTimeout(r,50));store.close()}
