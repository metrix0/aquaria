// Elemental spell sprites. Coordinates are local to the projectile/impact.
// Deterministic noise keeps pixel clusters coherent between animation frames.
const noise=(n)=>{const v=Math.sin(n*127.1+17.7)*43758.5453;return v-Math.floor(v);};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function cluster(rect,x,y,r,c) {
  r=Math.max(1,Math.round(r));x=Math.round(x);y=Math.round(y);
  rect(x-r,y-r+1,r*2,Math.max(1,r*2-2),c);
  if(r>2){rect(x-r+1,y-r,r*2-2,1,c);rect(x-r+1,y+r-1,r*2-2,1,c);}
}
function bolt(ctx,points,color,width) {
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));ctx.stroke();
}
function lightning(ctx,x,y,tx,ty,seed,alpha=1) {
  const dx=tx-x,dy=ty-y,len=Math.hypot(dx,dy)||1,n=Math.max(3,Math.ceil(len/9)),pts=[[x,y]];
  for(let i=1;i<n;i++){
    const q=i/n,offset=(noise(i+seed)-.5)*Math.min(18,len*.3);
    pts.push([x+dx*q-dy/len*offset,y+dy*q+dx/len*offset]);
  }
  pts.push([tx,ty]);ctx.save();ctx.globalAlpha*=alpha;
  bolt(ctx,pts,'#6179c7',6);bolt(ctx,pts,'#b4cbff',3);bolt(ctx,pts,'#f9fbff',1);
  for(let i=1;i<pts.length-1;i+=2){
    const [px,py]=pts[i],side=noise(i+seed*2)>.5?1:-1;
    bolt(ctx,[[px,py],[px-dy/len*side*8+dx/len*4,py+dx/len*side*8+dy/len*4],[px-dy/len*side*15+dx/len*8,py+dx/len*side*15+dy/len*8]],'#adcaff',1);
  }
  ctx.restore();
}
export function drawElementalProjectile(ctx,rect,polygon,arrow) {
  const t=1.2-arrow.life;
  if(arrow.spell==='firebolt'){
    // Turbulent, orange flame tongue, hot white core, and charcoal smoke.
    for(let i=9;i>=0;i--){
      const x=-6-i*3,y=Math.sin(i*1.7-t*21)*(2+i*.4),r=5-i*.4;
      cluster(rect,x,y,r+1,i>5?'#644044':'#9d4031');
      if(i<7)cluster(rect,x+1,y,r,i%2?'#e85c32':'#ff9b42');
      if(i<3)cluster(rect,x+2,y,r*.6,'#ffd67d');
    }
    cluster(rect,2,0,6,'#c3492d');cluster(rect,3,0,5,'#ff8738');
    cluster(rect,4,0,3,'#ffcf66');cluster(rect,5,0,2,'#fff4ca');
    for(let i=0;i<5;i++)rect(-10-i*5,Math.sin(i*5-t*17)*7,2,1,'#ffd05d');
  }else if(arrow.spell==='frost-lance'){
    // Long, angular translucent ice crystal and flaking shards.
    polygon([[-20,0],[-8,-5],[2,-6],[15,0],[2,6],[-8,4]],'#427a9d');
    polygon([[-17,0],[-5,-4],[15,0],[-5,1]],'#d9f9ff');
    polygon([[-17,0],[-5,1],[15,0],[-1,5]],'#80c8e0');
    polygon([[-8,-5],[2,-6],[15,0],[-5,-4]],'#f4ffff');
    for(let i=0;i<6;i++){const x=-14-i*3,y=(noise(i+5)-.5)*12;rect(x,y,2,2,'#a8e8f4');}
  }else{
    // A fast, branching electrical discharge rather than a colored magic dart.
    const seed=Math.floor(t*25);
    lightning(ctx,-31,0,10,0,seed);
    cluster(rect,7,0,3,'#e4edff');
  }
}
export function drawElementalImpact(ctx,rect,polygon,fx) {
  const t=clamp(1-fx.life/fx.duration,0,1),r=fx.radius||1;
  if(fx.spellFx==='beam'){
    lightning(ctx,0,0,fx.endX-fx.x,fx.endY-fx.y,Math.floor(t*12),1-t);return;
  }
  if(fx.spellFx==='healing-stream'){
    const dx=fx.endX-fx.x,dy=fx.endY-fx.y;
    for(let i=0;i<12;i++){const q=(i/12+t*.9)%1,px=dx*q,py=dy*q+Math.sin(q*12-t*8)*4;
      ctx.save();ctx.globalAlpha*=Math.sin(q*Math.PI)*(1-t*.65);cluster(rect,px,py,2,'#8acb73');rect(px,py-1,1,2,'#e2f6ae');ctx.restore();}
    return;
  }
  if(fx.spellFx==='firebolt'){
    // Expanding overlapping fireballs turn into rising smoke; sparks follow
    // ballistic paths rather than forming a decorative outline.
    for(let i=0;i<19;i++){
      const a=noise(i+2)*Math.PI*2,dist=(.22+.78*noise(i+65))*r*Math.min(1,t*3.6);
      const x=Math.cos(a)*dist,y=Math.sin(a)*dist-t*15,sz=(5+noise(i+8)*8)*(1-t*.55);
      ctx.save();ctx.globalAlpha*=Math.min(1,(1-t)*2.3);
      cluster(rect,x,y,sz+2,t>.48?'#55444a':'#8e3831');
      cluster(rect,x,y,sz,t>.55?'#78605b':t>.28?'#da542b':'#ff933c');
      if(t<.48)cluster(rect,x+1,y-1,sz*.52,t<.2?'#fff0b0':'#ffbf4c');
      ctx.restore();
    }
    for(let i=0;i<30;i++){
      const a=noise(i+91)*Math.PI*2,d=r*(.65+noise(i+20)*.65)*t*1.35;
      const x=Math.cos(a)*d,y=Math.sin(a)*d+24*t*t;
      ctx.save();ctx.globalAlpha*=1-t;rect(x,y,2+(i%3===0?2:0),2,i%3?'#ffad48':'#ffe18c');ctx.restore();
    }
    return;
  }
  if(fx.spellFx==='storm-arc'){
    // Brief contact flash and tiny, jagged electrical sparks at the struck
    // point. No cloud or downward strike; the beam provides the direction.
    ctx.save();ctx.globalAlpha*=1-t;
    if(t<.3){cluster(rect,0,0,4*(1-t),'#a9bfff');cluster(rect,0,0,2,'#ffffff');}
    for(let i=0;i<7;i++){
      const a=noise(i+11)*Math.PI*2,d=r*(.3+t*.9),px=Math.cos(a)*d,py=Math.sin(a)*d;
      const dx=Math.cos(a)*4,dy=Math.sin(a)*4;
      bolt(ctx,[[px-dx,py-dy],[px-dy*.7,py+dx*.7],[px+dx,py+dy]],i%2?'#b4cbff':'#f9fbff',1);
    }
    ctx.restore();return;
  }
  if(fx.spellFx==='frost-lance'){
    for(let i=0;i<11;i++){
      const a=i*2.399,d=(.25+noise(i+8))*r*t*1.4,x=Math.cos(a)*d,y=Math.sin(a)*d+10*t*t;
      const h=(4+noise(i+13)*8)*(1-t*.5);
      ctx.save();ctx.globalAlpha*=1-t;
      polygon([[x-3,y+3],[x+Math.cos(a)*h,y+Math.sin(a)*h],[x+3,y-2],[x,y+4]],'#69aecf');
      polygon([[x,y],[x+Math.cos(a)*h,y+Math.sin(a)*h],[x+2,y-1]],'#ddfbff');
      ctx.restore();
    }
    return;
  }
  if(fx.spellFx==='tidal-pulse'){
    // Two broad breaking sheets of water surge outward, with foam on their
    // leading edge and individual droplets peeling away from the crest.
    for(const side of [-1,1]){
      const reach=r*Math.min(1,t*1.7),h=(16+Math.sin(t*6)*6)*(1-t*.8);
      ctx.save();ctx.scale(side,1);ctx.globalAlpha*=1-t*.75;
      polygon([[0,8],[reach*.32,5],[reach*.65,-h*.55],[reach*.9,-h],[reach,-h*.6],[reach*.84,0],[reach,7],[reach*.7,10]],'#327f9c');
      polygon([[reach*.15,7],[reach*.53,2],[reach*.85,-h],[reach,-h*.6],[reach*.78,-1],[reach*.9,5],[reach*.7,8]],'#64c9d1');
      polygon([[reach*.64,-h*.55],[reach*.85,-h],[reach,-h*.6],[reach*.92,-h*.42],[reach*.8,-h*.65]],'#d0fff1');
      for(let i=0;i<14;i++){const x=reach*(.45+noise(i+9)*.65),y=-noise(i+25)*h-t*12;rect(x,y,1+i%3,2,i%3?'#8ee1e1':'#e9fff4');}
      ctx.restore();
    }
    // Rising and falling spray makes the radial push readable underwater, too.
    for(let i=0;i<16;i++){const a=i*2.399,d=r*t*(.35+noise(i+31)*.6);ctx.save();ctx.globalAlpha*=1-t;rect(Math.cos(a)*d,Math.sin(a)*d,2,3,'#a4eae5');ctx.restore();}
    return;
  }
  if(fx.spellFx==='mend'){
    // Leaves and golden pollen lift from the recipient, not a magic circle.
    for(let i=0;i<15;i++){
      const x=(noise(i+2)-.5)*30+Math.sin(t*7+i)*3,y=12-t*39-noise(i+14)*10;
      ctx.save();ctx.globalAlpha*=Math.sin(Math.PI*Math.min(.99,t+.13))*(.7+noise(i+7)*.3);
      if(i%3===0){rect(x,y,2,2,'#f4e7a1');rect(x-1,y+1,4,1,'#b7e49a');}
      else {polygon([[x-3,y+2],[x-2,y-2],[x+3,y-4],[x+2,y+1]],i%2?'#78b96c':'#b0e494');rect(x-1,y,3,1,'#e3f5bc');}
      ctx.restore();
    }
  }
}
export function drawFrozenMob(rect,polygon,spec,mob,front){
  const r=clamp(Math.round(spec?.radius??10),5,22),cy=spec?.centerY??0;
  if(!front){
    for(let i=0;i<4;i++){
      const x=(i-1.5)*r*.6,y=cy+r*.7,h=r*(1.3+noise(i)*.55);
      polygon([[x-5,y],[x-5,y-h*.5],[x,y-h],[x+5,y-h*.35],[x+4,y]],'#5688b2');
    }
  }else{
    for(let i=0;i<3;i++){
      const x=(i-1)*r*.65,y=cy+r*.82,h=r*(.55+noise(i+8)*.55);
      polygon([[x-5,y],[x-3,y-h*.7],[x,y-h],[x+5,y-h*.35],[x+4,y+1]],'#8bd1e2');
      polygon([[x-3,y-h*.7],[x,y-h],[x+2,y-1],[x,y]],'#e0faff');
    }
    rect(-r,cy+r*.9,r*2,2,'#bde8ed');
  }
}
