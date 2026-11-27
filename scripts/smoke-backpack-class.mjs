import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const port=6099, base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['scripts/dev.js'],{env:{...process.env,PORT:String(port)},stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  page.setDefaultTimeout(10000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const shortcut=page.locator('#backpack-class');
  const backpack=page.locator('#backpack-panel');
  const tree=page.locator('#skilltree-panel');
  await page.locator('#scene').waitFor();
  await page.keyboard.press('Tab'); await backpack.waitFor();
  assert.equal(await shortcut.isVisible(),false);
  await page.keyboard.press('Tab');await backpack.waitFor({state:'hidden'});
  await page.locator('#classes').click();
  await page.locator('[data-class="warden"]').click();
  await page.locator('#classes-panel [data-close]').click();
  await page.keyboard.press('Tab');await backpack.waitFor();
  assert.equal(await shortcut.textContent(),'Warden');
  await page.locator('#debug-souls').evaluate(b=>b.click());
  await shortcut.click();await tree.waitFor();
  assert.equal(await backpack.isVisible(),false);
  assert.equal(await tree.locator('.celestial-header h3').textContent(),'Warden');
  assert.equal(await tree.locator('[data-skill]').count(),9);
  for(const id of ['shield-discipline','ironwall','unyielding','battle-temper','bloodrush','reavers-oath']){
   await tree.locator('[data-skill="'+id+'"]').click();
   await tree.locator('#awaken-skill').click();
  }
  await tree.locator('[data-skill="watchers-ward"]').hover();
  assert.equal(await tree.locator('.celestial-inspector h4').textContent(),'Perfect Forge');
  if(viewport.width>720) {
   await tree.locator('[data-pick-skill="unyielding"]').dragTo(tree.locator('[data-drop-slot="1"]'));
  } else {
   await tree.locator('[data-pick-skill="unyielding"]').click();
   await tree.locator('[data-equip-slot="1"]').click();
  }
  assert.match(await tree.locator('[data-equip-slot="1"]').textContent(),/Shield Rush/);
  await tree.locator('[data-pick-skill="reavers-oath"]').click();
  await tree.locator('[data-equip-slot="1"]').click();
  assert.match(await tree.locator('[data-equip-slot="1"]').textContent(),/Rage/);
  await tree.locator('[data-clear-slot="1"]').click();
  assert.match(await tree.locator('[data-equip-slot="1"]').textContent(),/Empty/);
  assert.equal(await tree.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await tree.locator('#skilltree-switch-class').click();
  await page.locator('[data-class="scholar"]').click();
  await page.locator('#classes-panel [data-close]').click();
  await page.keyboard.press('Tab');await backpack.waitFor();
  assert.equal(await shortcut.textContent(),'Scholar');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#scene').waitFor();await page.keyboard.press('Tab');await backpack.waitFor();
  assert.equal(await shortcut.textContent(),'Scholar');
  await shortcut.click();await tree.waitFor();
  assert.equal(await tree.locator('.celestial-header h3').textContent(),'Scholar');
  assert.deepEqual(errors,[]);
  console.log('PASS '+viewport.width+'x'+viewport.height+': unassigned, assigned, switch, reload, skill tree');
  await page.close();
 }
}finally{await browser?.close();server.kill();}
