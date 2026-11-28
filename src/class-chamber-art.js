import { TILE } from './world/generation.js';
import { STATUE_AWAKEN_SECONDS } from './world/water-temple-interior.js';

// Procedural pixel-art reliefs, deliberately much larger than the player.
const C = { black:'#101922', dark:'#243543', stone:'#435962', mid:'#637d82', light:'#91a3a0',
  pale:'#b4c4bc', gold:'#a88b60', gilt:'#dbc498', recess:'#182731', floor:'#30454b' };
const clamp = x => Math.max(0,Math.min(1,x));

export function drawClassChamber(ctx, world, bounds, time, activeClass, reducedMotion) {
  const floor = (world.rows - 6) * TILE;
  const left = bounds.left*TILE, right = (bounds.right+1)*TILE;
  const visible = (x,w) => x+w>=left && x<=right;
  const rect = (x,y,w,h,color) => {
    if(w<=0||h<=0||!visible(x,w)) return;
    ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  };
  const poly = (p,color) => {
    if (!visible(Math.min(...p.map(v=>v[0])),Math.max(...p.map(v=>v[0]))-Math.min(...p.map(v=>v[0])))) return;
    ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const disc = (x,y,r,color) => {
    if (!visible(x-r,2*r)) return;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  };
  const ring = (x,y,r,color,width=2) => {
    if(!visible(x-r,2*r))return;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  const beam = (x,y,w,h,color) => {
    ctx.save();ctx.globalAlpha=.11;poly([[x-w,y],[x+w,y],[x+w*.45,y-h],[x-w*.45,y-h]],color);ctx.restore();
  };
  const gem = (x,y,r,color) => {
    poly([[x,y-r],[x+r,y],[x,y+r],[x-r,y]],C.dark);
    poly([[x,y-r+3],[x+r-3,y],[x,y+r-3],[x-r+3,y]],color);
    rect(x-1,y-r+4,2,Math.max(1,r-4),C.pale);
  };
  const cornice = (x,y,w) => {
    rect(x-6,y,w+12,5,C.pale);rect(x-3,y+5,w+6,9,C.stone);rect(x,y+14,w,3,C.gold);
  };
  function arch(cx,base,w,h) {
    const a=w/2, top=base-h;
    for(const [inset,color] of [[0,C.stone],[5,C.mid],[10,C.dark],[15,C.recess]]) {
      const k=a-inset;
      poly([[cx-k,base],[cx-k,top+75],[cx-k*.66,top+28],[cx,top+inset],
        [cx+k*.66,top+28],[cx+k,top+75],[cx+k,base]],color);
    }
    gem(cx,top+16,11,C.gold);
    rect(cx-a+6,top+80,3,h-80,C.gold);
    rect(cx+a-9,top+80,3,h-80,C.gold);
  }
  function column(x,base,h) {
    rect(x-18,base-8,36,8,C.mid);rect(x-14,base-h,28,h-8,C.stone);
    rect(x-13,base-h+14,5,h-26,C.light);
    for(const dx of [-5,3,10])rect(x+dx,base-h+18,3,h-30,C.dark);
    cornice(x-17,base-h,34);rect(x-19,base-16,38,4,C.gold);
  }

  // Full-height vaulted stone chamber, inset mortar and constellation motifs.
  rect(0,0,world.cols*TILE,floor,C.dark);
  for(let y=Math.max(0,Math.floor(bounds.top*TILE/24)*24);y<floor;y+=24) {
    const offset=(y/24%2)*24;
    for(let x=Math.max(0,Math.floor((left-offset)/48)*48+offset);x<right;x+=48) {
      const shade=((Math.floor(x/48)*19+Math.floor(y/24)*7)%5+5)%5;
      rect(x,y,47,23,['#293b48','#30424d','#344650','#2d404a','#384b55'][shade]);
      if(shade===4)rect(x+3,y+2,40,1,'#485b62');
    }
  }
  rect(0,floor-14,world.cols*TILE,14,C.stone);
  rect(0,floor-15,world.cols*TILE,3,C.gold);
  rect(0,50,world.cols*TILE,5,C.gold);
  rect(0,55,world.cols*TILE,10,C.stone);
  for(const item of world.items) {
    if(item.kind!=='class-statue'||!visible(item.x-160,320))continue;
    const x=item.x, base=item.floor*TILE, accent=item.accent;
    const awakening=world.statueAwakening?.id===item.id?world.statueAwakening:null;
    const progress=awakening?clamp(awakening.elapsed/STATUE_AWAKEN_SECONDS):0;
    const flash=awakening?Math.sin(Math.PI*progress):0;
    const attuned=activeClass===item.classId;
    arch(x,base-9,240,385);
    column(x-128,base,412);column(x+128,base,412);
    // Monumental carved halo and inlaid constellation panel.
    disc(x,base-257,96,C.dark);disc(x,base-257,90,C.gold);disc(x,base-257,85,C.recess);
    ring(x,base-257,72,attuned||awakening?accent:C.stone,3);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;gem(x+Math.cos(a)*79,base-257+Math.sin(a)*79,4,C.gold);}
    beam(x,base-22,96,354,accent);
    if(awakening){
      ctx.save();ctx.globalAlpha=.18+flash*.32;disc(x,base-176,55+flash*62,accent);ctx.restore();
      ring(x,base-170,38+progress*116,accent,3);
      for(let i=0;i<26;i++){
        const a=i*2.39996+progress*5;
        const radius=25+((i*29)%67)+progress*18;
        const px=x+Math.cos(a)*radius, py=base-22-progress*310+(i*19)%105;
        const q=i%4===0?4:2;rect(px,py,q,q,accent);
      }
    }
    const b=base-35, scale=3;
    const X=n=>x+n*scale,Y=n=>b+n*scale;
    const R=(dx,dy,w,h,color)=>rect(X(dx),Y(dy),w*scale,h*scale,color);
    const P=(p,color)=>poly(p.map(([dx,dy])=>[X(dx),Y(dy)]),color);
    // Heavy plinth, ornate stepped pedestal and class sigil.
    rect(x-70,base-8,140,8,C.dark);rect(x-65,base-14,130,6,C.light);
    rect(x-57,base-33,114,19,C.stone);rect(x-52,base-30,104,2,C.gold);
    rect(x-63,base-36,126,4,C.pale);gem(x,base-22,8,attuned||awakening?accent:C.gold);
    if(item.classId==='warden'){
      // Armored sentinel: enormous shield, greatsword, crested helmet.
      P([[-13,0],[-14,-24],[-20,-47],[-17,-63],[-8,-70],[8,-70],[18,-63],[20,-45],[13,-24],[14,0]],C.dark);
      P([[-9,-2],[-10,-27],[-14,-44],[-11,-61],[11,-61],[14,-44],[9,-27],[10,-2]],C.mid);
      P([[-17,-64],[-7,-70],[0,-61],[-8,-50],[-22,-53]],C.light);
      P([[17,-64],[7,-70],[0,-61],[8,-50],[22,-53]],C.light);
      R(-10,-44,20,4,C.gold);R(-8,-39,16,3,C.dark);
      R(-9,-85,18,16,C.stone);R(-7,-84,14,5,C.light);R(-8,-78,16,3,C.dark);
      R(-2,-79,4,1,awakening||attuned?accent:C.gold);R(-2,-91,4,7,C.gold);
      P([[-27,-55],[-11,-55],[-8,-45],[-9,-26],[-19,-16],[-28,-26]],C.dark);
      P([[-25,-53],[-13,-53],[-11,-44],[-12,-28],[-19,-20],[-25,-28]],C.gold);
      P([[-23,-50],[-15,-50],[-13,-42],[-14,-30],[-19,-24],[-23,-30]],C.stone);
      gem(X(-19),Y(-40),12,accent);
      R(23,-72,4,68,C.light);R(24,-70,1,64,C.pale);R(19,-25,12,3,C.gold);R(24,-23,2,12,C.dark);
      R(-9,-13,7,12,C.dark);R(2,-13,7,12,C.dark);
    } else if(item.classId==='wayfarer'){
      // Hooded ranger with sweeping cloak, longbow and arrow.
      P([[-5,-85],[-14,-77],[-19,-57],[-27,-20],[-31,0],[18,0],[14,-23],[19,-55],[10,-77],[5,-85]],C.dark);
      P([[-5,-81],[-12,-70],[-14,-52],[-23,-4],[-6,-10],[-1,-33],[10,-5],[15,-5],[11,-46],[15,-61],[8,-75]],C.mid);
      P([[-11,-75],[0,-88],[11,-75],[8,-65],[-8,-65]],C.light);
      P([[-7,-74],[0,-80],[7,-74],[5,-66],[-5,-66]],C.recess);
      R(-5,-72,3,1,accent);R(2,-72,3,1,accent);
      P([[-12,-59],[-26,-42],[-23,-36],[-5,-52]],C.light);
      P([[10,-60],[22,-48],[18,-43],[5,-51]],C.stone);
      P([[-18,-58],[-13,-61],[12,-29],[8,-25]],C.gold);
      R(-10,-41,20,3,C.gold);
      P([[23,-81],[30,-74],[34,-62],[34,-42],[30,-29],[23,-21],[26,-34],[29,-45],[29,-60],[26,-72]],C.gold);
      P([[23,-81],[24,-81],[24,-21],[23,-21]],C.pale);
      R(1,-49,32,1,C.light);P([[33,-51],[39,-49],[33,-47]],C.pale);
      R(-8,-8,5,8,C.dark);R(5,-8,5,8,C.dark);
    } else {
      // Archmage with floating grimoire, star-tipped staff and layered robes.
      P([[-9,-80],[-17,-64],[-18,-47],[-25,-5],[-27,0],[25,0],[20,-9],[17,-45],[15,-64],[8,-80]],C.dark);
      P([[-9,-77],[-12,-63],[-9,-44],[-19,-4],[-5,-5],[0,-32],[6,-5],[19,-4],[10,-43],[11,-63],[7,-77]],C.mid);
      P([[-12,-72],[0,-91],[12,-72],[7,-64],[-7,-64]],C.light);
      P([[-7,-73],[0,-80],[7,-73],[5,-65],[-5,-65]],C.recess);
      R(-5,-71,3,1,accent);R(2,-71,3,1,accent);
      P([[-12,-60],[-24,-48],[-20,-39],[-5,-52]],C.light);
      P([[11,-60],[22,-48],[20,-42],[5,-52]],C.light);
      P([[-7,-58],[0,-52],[7,-58],[4,-45],[0,-41],[-4,-45]],C.gold);
      R(-10,-35,20,3,C.gold);R(25,-75,3,75,C.gold);R(26,-72,1,70,C.gilt);
      gem(X(26.5),Y(-83),18,accent);
      const bob=awakening&&!reducedMotion?Math.round(Math.sin(progress*Math.PI)*13):0;
      P([[-33,-51],[-22,-55],[-11,-50],[-11,-38],[-22,-43],[-33,-40]],C.dark);
      const bookY=Y(-52)-bob;
      poly([[X(-32),bookY],[X(-22),bookY-8],[X(-12),bookY],[X(-12),bookY+20],[X(-22),bookY+13],[X(-32),bookY+20]],C.gold);
      poly([[X(-30),bookY+2],[X(-22),bookY-5],[X(-14),bookY+2],[X(-14),bookY+16],[X(-22),bookY+10],[X(-30),bookY+16]],C.pale);
      rect(X(-22)-1,bookY-5,2,16,C.dark);
    }
    // Class-specific sigil floats above the statue only on activation / attunement.
    const sy=base-335;
    if(attuned||awakening){
      const p=awakening?progress:1;
      ctx.save();ctx.globalAlpha=awakening?Math.max(.15,p):.85;
      ring(x,sy,23+flash*10,accent,2);
      if(item.classId==='warden')poly([[x,sy-15],[x+12,sy-8],[x+10,sy+8],[x,sy+15],[x-10,sy+8],[x-12,sy-8]],accent);
      else if(item.classId==='wayfarer')poly([[x-13,sy+11],[x+10,sy-12],[x+13,sy-3],[x+10,sy-9],[x+4,sy-12],[x+10,sy-12],[x-10,sy+14]],accent);
      else gem(x,sy,16,accent);
      ctx.restore();
    }
    // Permanent carved name, readable at normal zoom, not a floating UI monitor.
    if(typeof ctx.fillText==='function'){
      ctx.save();ctx.font='bold 11px serif';ctx.textAlign='center';ctx.fillStyle=C.gilt;
      ctx.fillText(item.name.toUpperCase(),x,base-18);ctx.restore();
    }
  }
  for(const door of world.templeDoors){
    const {x,y,width,height}=door.bounds;
    arch(x+width/2,y+height,width+26,height+24);
    rect(x,y,width,height,C.dark);rect(x+3,y+3,width-6,height-3,C.stone);
    rect(x+width/2-1,y,2,height,C.black);
    rect(x,y+22,width,4,C.gold);rect(x,y+height-26,width,4,C.gold);
    gem(x+width/2,y+height/2,10,C.gilt);
  }
  for(const {tx,floor:row} of world.braziers??[]){
    const x=(tx+.5)*TILE,y=row*TILE;
    rect(x-9,y-4,18,4,C.mid);rect(x-5,y-25,10,21,C.stone);rect(x-10,y-28,20,5,C.gold);
    const h=15+(reducedMotion?0:Math.sin(time*4+x)*3);
    poly([[x-7,y-28],[x,y-28-h],[x+7,y-28]],'#79b9cf');
    poly([[x-3,y-28],[x,y-24-h],[x+3,y-28]],'#d3f9ff');
  }
}
