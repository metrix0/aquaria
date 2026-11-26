import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=process.env.AQUARIA_TEST_URL ?? 'http://localhost:6002';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
for(const viewport of [{width:1113,height:595},{width:390,height:844}]){
 const page=await browser.newPage({viewport});
 await page.route('**/src/render.js?seamprobe',async route=>{
   const res=await route.fetch();
   const source=await res.text();
   const before='    shadeAtmosphere(camera, conditions, time,';
   const after='    auroraLight(camera, surface, time, conditions);';
   assert.ok(source.includes(before)&&source.includes(after));
   await route.fulfill({response:res,body:source.replace(before,'    window.beforeGrade = ctx.getImageData(0, 0, canvas.width, canvas.height);\n'+before).replace(after,'    window.afterGrade = ctx.getImageData(0, 0, canvas.width, canvas.height);\n'+after)});
 });
 await page.goto(base+'/start');
 const result=await page.evaluate(async viewport=>{
 const {createRenderer}=await import('/src/render.js?seamprobe');
 const {createGame}=await import('/src/gameplay/simulation.js');
 const {worldConditions}=await import('/src/environment.js');
 const {SPAWN,TILE}=await import('/src/world/generation.js');
 const game=createGame();game.world.mobs=[];
 const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;document.body.replaceChildren(canvas);
 const renderer=createRenderer(canvas);
 const results=[];
 for(const zoom of [.75,1,1.25,2.5]){
 for(const offset of [-14,0,14]){
 for(const mood of ['night','deep-night','day']){
 const camera={x:SPAWN.x+offset*TILE+.3,y:0,width:canvas.width/zoom,height:canvas.height/zoom};
 renderer.draw({world:game.world,player:game.player,camera,time:1,elapsed:1,particles:[],playerArrows:[],conditions:worldConditions(0,0,mood),worldTime:0,weatherSeed:0,reducedMotion:true,peers:[]});
 const before=window.beforeGrade.data,after=window.afterGrade.data;
 // Pixels with the same underlying color on a single sky row must receive
 // the same tint. Ignore distant biome changes by restricting the sample.
 for(const y of [8,16,24,35]){
 const groups=new Map();
 for(let x=0;x<Math.min(canvas.width,Math.floor(300*zoom));x++){
 const i=(y*canvas.width+x)*4;
 const k=Array.from(before.slice(i,i+3)).join(',');
 const v=Array.from(after.slice(i,i+3)).join(',');
 if(!groups.has(k))groups.set(k,new Map());
 const colors=groups.get(k);colors.set(v,(colors.get(v)??0)+1);
 }
 const common=[...groups].sort((a,b)=>[...b[1].values()].reduce((x,y)=>x+y,0)-[...a[1].values()].reduce((x,y)=>x+y,0))[0];
 if(common && common[1].size!==1)results.push({zoom,offset,mood,y,before:common[0],after:[...common[1]]});
 }
 }
 }
 }
 return results;
 },viewport);
 console.log(viewport.width,JSON.stringify(result));
 assert.deepEqual(result,[]);
 await page.close();
}
}finally{await browser.close()}
