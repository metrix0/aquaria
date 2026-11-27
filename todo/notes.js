import { config } from '/src/config.js';
const names = ['Rafael', 'Joao'];
const client = config.url && config.publishableKey;
const states = names.map(name => ({name, field:document.getElementById(name), status:document.getElementById(name+'-status'), retry:document.getElementById(name+'-retry'), loaded:false, dirty:false, saving:false, timer:null, revision:0}));
const warn = e => { e.preventDefault(); e.returnValue = ''; };
function guard(){ if(states.some(s=>s.dirty||s.saving)) window.addEventListener('beforeunload',warn); else window.removeEventListener('beforeunload',warn); }
async function request(name, method='GET', body){
 if(!client) throw Error('Storage is not configured');
 const url = config.url+'/rest/v1/development_notes?author=eq.'+encodeURIComponent(name);
 const response = await fetch(url,{method,headers:{apikey:config.publishableKey,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok) throw Error('Storage unavailable');
 const rows=await response.json(); if(rows.length!==1) throw Error('Note unavailable'); return rows[0];
}
async function load(s){
 s.retry.hidden=true; s.status.textContent='Loading…';
 try {const row=await request(s.name); s.field.value=row.body; s.loaded=true; s.field.disabled=false; s.status.textContent='Saved';}
 catch {s.status.textContent='Could not load'; s.retry.hidden=false;}
}
async function save(s){
 if(!s.loaded||!s.dirty||s.saving)return;
 clearTimeout(s.timer); s.saving=true; s.retry.hidden=true; s.status.textContent='Saving…'; guard();
 const revision=s.revision, body=s.field.value;
 try {await request(s.name,'PATCH',{body}); if(s.revision===revision)s.dirty=false; s.status.textContent=s.dirty?'Saving…':'Saved';}
 catch {s.status.textContent='Not saved — retry'; s.retry.hidden=false;}
 finally {s.saving=false; guard(); if(s.dirty&&s.revision!==revision){s.timer=setTimeout(()=>save(s),500);}}
}
for(const s of states){
 s.field.addEventListener('input',()=>{s.revision++;s.dirty=true;s.status.textContent='Saving…';guard();clearTimeout(s.timer);s.timer=setTimeout(()=>save(s),500);});
 s.field.addEventListener('blur',()=>save(s));
 s.retry.addEventListener('click',()=>s.loaded?save(s):load(s));
 load(s);
}
