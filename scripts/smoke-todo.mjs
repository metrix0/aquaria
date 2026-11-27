import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const port=6098;
const server=spawn(process.execPath,['scripts/dev.js'],{env:{...process.env,PORT:String(port)},stdio:'inherit'});
let browser;
try {
 const base='http://127.0.0.1:'+port;
 for(let i=0;i<50;i++){try{if((await fetch(base+'/todo')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1200,height:800}}); page.setDefaultTimeout(10000); page.on('pageerror',e=>console.error(e));
 const db={Rafael:'initial R',Joao:'initial J'}; let fail=false;
 await page.route('**/src/config.js',r=>r.fulfill({contentType:'text/javascript',body:'export const config={url:"http://127.0.0.1:6098/mock",publishableKey:"test"}'}));
 await page.route('http://127.0.0.1:6098/mock/**',async r=>{
  const req=r.request(),name=new URL(req.url()).searchParams.get('author').slice(3);
  if(req.method()==='PATCH'){await new Promise(x=>setTimeout(x,800)); if(fail)return r.fulfill({status:503,body:'unavailable'}); db[name]=req.postDataJSON().body;}
  return r.fulfill({json:[{author:name,body:db[name]}]});
 });
 await page.goto(base+'/todo'); const r=page.locator('#Rafael'),j=page.locator('#Joao');
 await r.waitFor(); await page.waitForFunction(()=>!document.getElementById('Rafael').disabled&&!document.getElementById('Joao').disabled);
 assert.equal(await r.inputValue(),'initial R'); assert.equal(await j.inputValue(),'initial J');
 assert.ok((await j.boundingBox()).x>(await r.boundingBox()).x);
 await page.setViewportSize({width:1700,height:850});
 assert.ok((await r.boundingBox()).width>790);
 assert.ok((await r.boundingBox()).height>700);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
 await r.fill('R updated'); 
 assert.equal(await page.locator('#Rafael-status').textContent(),'Saving…');
 assert.equal(await page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true}))),true);
 await page.waitForTimeout(650); await r.fill('R final'); await j.fill('J final');
 await page.waitForFunction(()=>['Rafael','Joao'].every(n=>document.getElementById(n+'-status').textContent==='Saved'));
 assert.deepEqual(db,{Rafael:'R final',Joao:'J final'});
 assert.equal(await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true}))),true);
 fail=true; await j.fill('retry me'); await page.waitForFunction(()=>document.getElementById('Joao-status').textContent.includes('Not saved'));
 assert.equal(await page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true}))),true);
 fail=false; await page.locator('#Joao-retry').click(); await page.waitForFunction(()=>document.getElementById('Joao-status').textContent==='Saved');
 await page.reload(); await page.waitForFunction(()=>!document.getElementById('Joao').disabled);
 assert.equal(await j.inputValue(),'retry me'); assert.equal(await r.inputValue(),'R final');
 await page.setViewportSize({width:390,height:844}); assert.ok((await j.boundingBox()).y>(await r.boundingBox()).y);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS: desktop/mobile layout, independent autosave, edits during save, unload guard, failure/retry, reload');
} finally {await browser?.close();server.kill();}
