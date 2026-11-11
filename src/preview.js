import { createServer } from 'node:http';
import { widgetHTML } from './widget.js';
import { checkSizes } from './sizes.js';
import { shop } from './config.js';
const html=widgetHTML();checkSizes(html);
// This adapter is injected only by the local preview server, never by the bot.
const adapter=`<script>
const listeners={};let saved=null;
window.TelegramWidget={chatData:null,ready(){},onEvent(name,fn){listeners[name]=fn},request(payload){
 if(new TextEncoder().encode(payload).length>64)return Promise.reject(new Error('size'));
 const cart=JSON.parse(payload),products=${JSON.stringify(shop.products)};
 if(!cart.length)return Promise.reject(new Error('empty'));
 if(!saved){const items=cart.map(([id,quantity])=>{const p=products.find(p=>p.id===id);if(!p||!Number.isInteger(quantity)||quantity<1||quantity>20)throw Error('cart');return {...p,quantity}});saved={id:'PREVIEW-001',items,total:items.reduce((s,p)=>s+p.price*p.quantity,0)}}
 return new Promise(resolve=>setTimeout(()=>{this.chatData=JSON.stringify(saved);if(listeners.chatDataChanged)listeners.chatDataChanged();resolve({result:this.chatData})},300));
}};
</script>`;
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BLOOM · Widget preview</title><style>body{margin:0;background:#eceee9;color:#28382e;font:14px system-ui}main{max-width:420px;margin:32px auto;padding:0 12px}h1{font-size:18px}p{line-height:1.5}nav{display:flex;gap:8px;margin:16px 0}button{border:1px solid #9da69c;border-radius:8px;background:transparent;color:inherit;padding:10px;cursor:pointer}iframe{display:block;border:1px solid #d6d9cf;border-radius:18px;width:100%;height:550px;background:#faf8f4;box-sizing:border-box}body.dark{background:#141c19;color:#eee}small{display:block;margin-top:16px;color:inherit}</style><main><h1>Preview — simulated Telegram</h1><p>The same BLOOM HTML widget, with a local test adapter. No messages or real orders.</p><nav><button id="theme">Switch to dark</button><button id="reset">New demo</button></nav><iframe id="widget" title="BLOOM demo widget" src="/widget"></iframe><small>Local browser preview · Telegram compatibility is not verified here.</small></main><script>let dark=false;const frame=document.getElementById('widget');function theme(){const s=frame.contentDocument.documentElement.style;const colors=dark?{bg:'#202b26',text:'#f3f0e8',hint:'#c0c8bd',secondary:'#33443b',button:'#bed5bd',buttonText:'#1d3227',separator:'#425047'}:{bg:'#faf8f4',text:'#262d29',hint:'#666b65',secondary:'#eeece6',button:'#345447',buttonText:'#ffffff',separator:'#e4e1da'};Object.entries({bg:'bg-color',text:'text-color',hint:'hint-color',secondary:'secondary-bg-color',button:'button-color',buttonText:'button-text-color',separator:'section-separator-color'}).forEach(([k,v])=>s.setProperty('--tg-theme-'+v,colors[k]));document.body.className=dark?'dark':'';document.getElementById('theme').textContent=dark?'Switch to light':'Switch to dark'}frame.onload=theme;document.getElementById('theme').onclick=()=>{dark=!dark;theme()};document.getElementById('reset').onclick=()=>frame.src='/widget';</script></html>`;
const server=createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'self'; frame-ancestors 'self'; connect-src 'none'");
  if(req.url==='/')res.end(page);
  else if(req.url==='/widget')res.end(html.replace('<script>',adapter+'<script>'));
  else{res.statusCode=404;res.end('Not found')}
});
server.listen(3000,'127.0.0.1',()=>console.log('BLOOM preview listening on local port 3000 (simulated Telegram).'));
