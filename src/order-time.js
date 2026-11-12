// Georgia uses UTC+04:00 year-round. Dates are always displayed in Asia/Tbilisi.
export function timeConfig(db){return JSON.parse(db.prepare("SELECT value FROM metadata WHERE key='order_time_config'").get()?.value||'{"lead":60,"open":9,"close":20}');}
export function dateInTbilisi(now=Date.now(),day=0){return new Date(now+4*3600000+day*86400000).toISOString().slice(0,10);}
export function timeOptions(db,day=0,now=Date.now()){
 const cfg=timeConfig(db),date=dateInTbilisi(now,day),slots=[];
 for(let h=cfg.open;h<cfg.close;h++){
  const iso=date+'T'+String(h).padStart(2,'0')+':00:00+04:00';
  if(Date.parse(iso)>=now+cfg.lead*60000)slots.push(iso);
 }
 return slots;
}
export function desiredTimeText(value,words){if(value==='asap')return words.asap;if(!value)return '—';return value.slice(0,10)+' '+value.slice(11,16)+'–'+String(Number(value.slice(11,13))+1).padStart(2,'0')+':00 (Asia/Tbilisi)';}
export function validateTime(db,value){
 if(value==='asap')return;
 for(let day=0;day<=90;day++)if(timeOptions(db,day).includes(value))return;
 throw Object.assign(Error('Desired time is no longer available'),{code:'invalidTime'});
}
