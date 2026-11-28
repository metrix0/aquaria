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
    // Compact, stepped sprite in the same muted earth/amber palette as the
    // world's torches. A flickering tongue trails the hot leading edge.
    const flicker=Math.floor(t*18)%3-1;
    polygon([[-17,1],[-12,-2],[-8,-2],[-6,-5],[-2,-6],[3,-6],[6,-4],[8,-1],[8,2],[5,5],[1,6],[-4,5],[-8,3],[-13,3]],'#813f32');
    polygon([[-14,flicker],[-7,-1],[-4,-4],[1,-5],[5,-3],[7,0],[5,3],[1,5],[-4,3],[-8,2]],'#c45c38');
    polygon([[-8,0],[-3,-3],[2,-4],[5,-2],[6,1],[3,3],[-1,4],[-4,2]],'#ed984d');
    polygon([[-2,0],[0,-2],[3,-2],[5,0],[3,2],[0,2]],'#f6cf85');
    rect(2,-1,2,2,'#fff1c6');
    rect(-15,-3+flicker,2,1,'#dc874d');
    rect(-20,2-flicker,2,1,'#b26b45');
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
    // A single, short, cohesive explosion, not a cloud of floating blobs.
    // The flame front and sparks remain inside the actual blast radius.
    const swell=Math.min(1,.24+t*3.8),outer=r*swell;
    const contour=(size,phase=0)=>Array.from({length:24},(_,i)=>{
      const a=i*Math.PI/12,rad=size*(i%2?.62+.13*noise(i+phase):.85+.13*noise(i+phase));
      return [Math.cos(a)*rad,Math.sin(a)*rad];
    });
    ctx.save();ctx.globalAlpha*=Math.min(1,(1-t)*2.5);
    if(t<.62){
      const fade=1-Math.max(0,t-.24)*.8;
      polygon(contour(outer,4),'#823e32');
      polygon(contour(outer*.83,4),'#bf5837');
      polygon(contour(outer*.57*fade,7),'#e98d49');
      polygon(contour(outer*.28*fade,9),'#f6cb7d');
      if(t<.25)polygon(contour(outer*.12,2),'#fff1c6');
    }
    for(let i=0;i<20;i++){
      const a=i*2.399,d=r*Math.min(.96,.2+t*(.65+noise(i+31)*.55));
      const x=Math.cos(a)*d,y=Math.sin(a)*d;
      rect(x-1,y-1,i%4===0?3:2,2,i%3?'#d78349':'#f6cc82');
    }
    ctx.restore();return;
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
    // Damage is immediate in all directions. Show its complete footprint
    // immediately, then a rapidly expanding, foamy water front. Per-angle
    // reach comes from the combat world's solid tiles at the moment of cast.
    const reach=fx.reach??Array(64).fill(r),n=reach.length;
    const point=(i,d)=>{const a=i*Math.PI*2/n;return [Math.cos(a)*d,Math.sin(a)*d];};
    const limits=reach.map(d=>clamp(d,0,r));
    ctx.save();
    ctx.globalAlpha*=Math.max(0,1-t);
    // A faint water wash covers the real accessible damage area from frame 1.
    polygon(limits.map((d,i)=>point(i,d)),'#438eaa32');
    const front=r*Math.min(1,.35+t*4.5),width=4+6*(1-t);
    for(let i=0;i<n;i++){
      const j=(i+1)%n,a=Math.min(front,limits[i]),b=Math.min(front,limits[j]);
      if(a<1||b<1)continue;
      const innerA=Math.max(0,a-width),innerB=Math.max(0,b-width);
      polygon([point(i,innerA),point(i,a),point(j,b),point(j,innerB)],'#327b98aa');
      polygon([point(i,Math.max(0,a-5)),point(i,a),point(j,b),point(j,Math.max(0,b-5))],'#72c5d5');
      // Broken, irregular pale foam with no decorative runes or extra rings.
      if(i%5!==2){
        polygon([point(i,Math.max(0,a-2)),point(i,a),point(j,b),point(j,Math.max(0,b-2))],i%3?'#bce9e6':'#e7f5e8');
      }
      if(i%4===0&&a>4){
        const d=Math.max(0,a-3-noise(i+11)*width),[px,py]=point(i,d);
        rect(px,py,1,1,'#e0f2ed');
      }
    }
    ctx.restore();return;
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
