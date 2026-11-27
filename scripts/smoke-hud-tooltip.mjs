import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const port=6097, base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['scripts/dev.js'],{env:{...process.env,PORT:String(port)},stdio:'inherit'});
let browser;
try {
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
 const html=(await readFile('dist/index.html','utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport});
  await page.route(base+'/',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto(base);
  await page.evaluate(async()=>{
   const {createInventoryUi}=await import('/src/inventory-ui.js');
   const inventory={hotbar:[{id:'firebolt-tome',count:1}],backpack:[]};
   const ui=createInventoryUi(document.querySelector('#backpack-panel'),{getInventory:()=>inventory,getAddon:()=>null,onSelect:()=>{},getChest:()=>[]});
   ui.render(0);
   document.querySelector('#mana-meter').hidden=false;
   document.querySelector('#mana-label').textContent='22 / 30';
  });
  const slot=page.locator('#hotbar-slots .slot').first();
  await slot.hover();
  const tooltip=page.locator('#inventory-tooltip');
  await tooltip.waitFor({state:'visible'});
  const hud=await page.locator('.hud-above-hotbar').boundingBox(), tip=await tooltip.boundingBox();
  const mana=await page.locator('#mana-meter').boundingBox(), health=await page.locator('.vital-health:not(.mana-meter)').boundingBox();
  assert.ok(mana.y<health.y,'mana must be above health');
  assert.ok(tip.y+tip.height<=hud.y-6,'tooltip overlaps HUD: '+JSON.stringify({tip,hud}));
  assert.equal(await tooltip.evaluate(el=>getComputedStyle(el).zIndex),'4');
  assert.ok(tip.x>=0&&tip.x+tip.width<=viewport.width,'tooltip clipped');
  await page.mouse.move(0,0);
  await tooltip.waitFor({state:'hidden'});
  console.log('PASS '+viewport.width+'x'+viewport.height);
  await page.close();
 }
}finally{await browser?.close();server.kill();}
