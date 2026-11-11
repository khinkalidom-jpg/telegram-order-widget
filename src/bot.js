import {ShopStore} from './shop-store.js';
import {createApi} from './api.js';
import {handleQuery,drainJobs} from './service.js';
import {openView,storefrontQuery,syncViews} from './storefront-service.js';
import {adminUpdate} from './admin.js';
import {ui} from './config.js';
const token=process.env.BOT_TOKEN,admin=process.env.ADMIN_CHAT_ID;
if(!token){console.error('BOT_TOKEN is required.');process.exit(1)}
if(admin&&!/^-?\d+$/.test(admin)){console.error('ADMIN_CHAT_ID must be numeric.');process.exit(1)}
const store=new ShopStore(process.env.DATABASE_PATH||'./data/bloom.sqlite'),api=createApi(token);
let running=true,working=false;
process.on('SIGINT',()=>{running=false});process.on('SIGTERM',()=>{running=false});
const worker=setInterval(async()=>{if(working)return;working=true;try{await drainJobs(store,api,admin);await syncViews(store,api)}catch{console.warn('Delivery worker will retry.')}finally{working=false}},1500);
try{
 const me=await api('getMe',{});const webhook=await api('getWebhookInfo',{});if(webhook.url)throw Error('Remove the existing webhook before polling.');
 await api('setMyCommands',{commands:ui.commands});await api('setChatMenuButton',{menu_button:{type:'commands'}});
 await api('setMyShortDescription',{short_description:ui.shortDescription});await api('setMyDescription',{description:ui.description});
 console.log(`BLOOM bot @${me.username} connected.`);
 while(running){try{const updates=await api('getUpdates',{offset:store.offset(),timeout:25,limit:10,allowed_updates:['message','widget_query','callback_query']},30000);
 for(const u of updates){if(store.db.prepare('SELECT 1 FROM handled_updates WHERE id=?').get(u.update_id))continue;
 if(u.widget_query){const q=u.widget_query;const known=store.db.prepare('SELECT 1 FROM views WHERE chat=? AND message=?').get(String(q.chat?.id),q.message_id);if(known)await storefrontQuery(q,store,api);else await handleQuery(q,store,api)}
 else if(!await adminUpdate(u,store,api,process.env.ADMIN_USER_ID)){const m=u.message;if(m?.text&&m.chat.type==='private'){const [raw]=m.text.trim().split(/\s/),[cmd,mention]=raw.split('@');if(!mention||mention.toLowerCase()===me.username.toLowerCase()){const screen={'/start':'home','/catalog':'catalog','/cart':'cart','/help':'help'}[cmd];if(screen)await openView(store,api,m.from.id,m.chat.id,screen);else if(cmd==='/id')await api('sendMessage',{chat_id:m.chat.id,text:`User ID: ${m.from.id}\nChat ID: ${m.chat.id}`})}}}
 store.db.prepare('INSERT OR IGNORE INTO handled_updates VALUES(?)').run(u.update_id);store.offset(u.update_id+1);
 }
 }catch(e){console.warn(`Polling/command error (${e.code||'internal'}). Retrying.`);await new Promise(r=>setTimeout(r,Math.max(1000,(e.retryAfter||0)*1000)))}}
}catch(e){console.error(e.code?`Telegram connection failed (${e.code}).`:e.message);process.exitCode=1}
finally{clearInterval(worker);while(working)await new Promise(r=>setTimeout(r,50));store.close()}
