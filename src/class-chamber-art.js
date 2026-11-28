import { TILE } from './world/generation.js';
import { STATUE_AWAKEN_SECONDS } from './world/water-temple-interior.js';

// Player-scale sculptures with directional stone facets and recessed architectural depth.
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
  rect(0,floor-48,world.cols*TILE,48,'#26363e');
  rect(0,floor-48,world.cols*TILE,3,'#576562');
  rect(0,floor-45,world.cols*TILE,2,'#17252c');
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
    ctx.save();ctx.globalAlpha=.48;
    arch(x,base-9,240,385);
    column(x-128,base,412);column(x+128,base,412);
    ctx.restore();
    // A carved, deep niche in front of the distant vaulted hall.
    const shadow='#18242b', dark='#384c51', mid='#718782', lit='#a1b2a6', edge='#c9cdb2';
    const bronze='#ab9067', gold='#dfc69a', glow=attuned||awakening?accent:'#8fa49d';
    const P0=(pts,c)=>poly(pts.map(([dx,dy])=>[x+dx,base+dy]),c);
    const R0=(dx,dy,w,h,c)=>rect(x+dx,base+dy,w,h,c);
    P0([[-55,-4],[-55,-91],[-34,-115],[0,-136],[34,-115],[55,-91],[55,-4]],'#50636a');
    P0([[-48,-4],[-48,-89],[-29,-111],[0,-128],[29,-111],[48,-89],[48,-4]],shadow);
    P0([[-48,-89],[-40,-85],[-40,-5],[-48,-4]],lit);
    P0([[48,-89],[40,-85],[40,-5],[48,-4]],dark);
    for(let j=-80;j<-8;j+=14){R0(-40,j,80,1,'#293941');R0(-40,j+1,80,1,'#35484a');}
    disc(x,base-84,24,'#293b43');ring(x,base-84,22,'#66776e',2);
    ring(x,base-84,17,'#405553',1);
    for(let i=0;i<8;i++){const q=i*Math.PI/4;R0(Math.cos(q)*20-1,-84+Math.sin(q)*20-1,2,2,bronze);}
    // Three-dimensional plinth: top, front, side and contact shadow.
    P0([[-25,-3],[18,-3],[27,0],[-17,0]],'#111b20');
    P0([[-24,-11],[18,-11],[25,-8],[-18,-8]],lit);
    R0(-18,-8,43,8,dark);R0(-18,-8,43,1,edge);
    P0([[18,-11],[25,-8],[25,0],[18,-3]],shadow);
    R0(-15,-5,32,3,mid);R0(-13,-4,28,1,bronze);

    const b=base-11;
    const R=(dx,dy,w,h,c)=>rect(x+dx,b+dy,w,h,c);
    const P=(pts,c)=>poly(pts.map(([dx,dy])=>[x+dx,b+dy]),c);
    // Shared stone palette, different asymmetrical silhouettes and equipment.
    if(item.classId==='warden'){
      P([[-8,0],[-10,-16],[-13,-29],[-10,-38],[-5,-41],[6,-41],[12,-35],[13,-25],[8,-14],[9,0]],shadow);
      P([[-6,-2],[-7,-15],[-8,-27],[-5,-36],[3,-36],[7,-29],[5,-16],[6,-2]],mid);
      P([[3,-36],[10,-32],[10,-25],[5,-15],[6,-2],[2,-2],[1,-16]],dark);
      P([[-14,-33],[-8,-39],[-2,-35],[-4,-28],[-13,-27],[-16,-30]],lit);
      P([[7,-38],[12,-34],[15,-30],[10,-26],[5,-30]],dark);
      R(-12,-34,6,1,edge);R(-6,-27,11,2,bronze);R(-5,-25,9,1,shadow);
      P([[-6,-24],[3,-24],[5,-20],[-5,-20]],lit);
      R(-6,-19,10,2,dark);R(-6,-14,4,11,dark);R(2,-14,4,11,shadow);
      R(-8,-3,7,3,lit);R(1,-3,8,3,mid);
      P([[-6,-41],[-7,-48],[-3,-53],[3,-53],[7,-49],[7,-42],[3,-39],[-3,-39]],shadow);
      P([[-6,-48],[-3,-52],[2,-52],[4,-49],[2,-42],[-5,-42]],mid);
      P([[-5,-48],[-3,-51],[1,-51],[1,-48]],lit);
      R(-5,-46,9,2,shadow);R(-4,-46,3,1,glow);R(-3,-55,3,3,bronze);R(-2,-56,1,3,gold);
      P([[-18,-29],[-9,-32],[-3,-28],[-5,-17],[-12,-9],[-18,-15]],shadow);
      P([[-17,-28],[-9,-30],[-5,-27],[-7,-18],[-12,-12],[-16,-17]],bronze);
      P([[-15,-26],[-9,-28],[-7,-26],[-9,-19],[-12,-15],[-14,-18]],mid);
      P([[-15,-26],[-9,-28],[-10,-22],[-14,-19]],lit);
      R(-12,-24,2,6,gold);R(-14,-22,6,2,gold);
      P([[15,-47],[18,-43],[17,-9],[14,-9],[14,-43]],shadow);
      R(14,-42,2,33,lit);R(14,-42,1,31,edge);R(11,-12,10,2,bronze);R(15,-10,2,7,dark);R(15,-3,3,2,gold);
    }else if(item.classId==='wayfarer'){
      P([[-6,-43],[-12,-32],[-10,-23],[-18,-2],[-5,0],[3,-5],[10,0],[9,-17],[12,-32],[6,-43]],shadow);
      P([[-9,-32],[-5,-40],[4,-39],[5,-28],[0,-15],[-12,-3],[-16,-3]],mid);
      P([[-8,-27],[-4,-30],[-5,-17],[-13,-5],[-9,-17]],lit);
      P([[4,-35],[10,-31],[7,-22],[8,-4],[3,-7],[1,-20]],dark);
      P([[-7,-42],[-5,-50],[0,-54],[5,-51],[8,-46],[5,-40],[-4,-40]],dark);
      P([[-6,-44],[-4,-50],[0,-53],[3,-50],[1,-45],[-3,-43]],lit);
      P([[-2,-49],[4,-48],[5,-43],[1,-41],[-2,-43]],shadow);R(1,-47,3,1,glow);
      P([[-8,-35],[-4,-37],[6,-25],[3,-23]],bronze);R(-4,-23,12,2,gold);
      P([[-5,-35],[-12,-26],[-10,-23],[1,-32]],lit);P([[5,-34],[14,-29],[14,-26],[7,-27]],mid);
      R(12,-29,3,2,edge);R(-3,-9,4,7,dark);R(4,-10,4,8,shadow);R(-4,-3,6,3,mid);R(4,-3,7,3,mid);
      P([[15,-49],[20,-43],[23,-36],[23,-23],[20,-16],[15,-11],[18,-19],[20,-25],[20,-35],[18,-42]],shadow);
      P([[15,-49],[19,-43],[21,-36],[21,-23],[19,-17],[15,-11],[17,-19],[19,-25],[19,-35],[17,-42]],bronze);
      R(15,-48,1,37,edge);R(2,-29,18,1,lit);P([[20,-31],[24,-29],[20,-27]],edge);
    }else{
      P([[-6,-44],[-12,-34],[-9,-23],[-16,-2],[-9,0],[12,0],[15,-3],[8,-23],[10,-35],[5,-44]],shadow);
      P([[-8,-34],[-5,-41],[4,-41],[6,-32],[2,-19],[-6,-2],[-13,-3]],mid);
      P([[-5,-29],[-2,-32],[-2,-20],[-9,-4],[-6,-17]],lit);
      P([[4,-34],[9,-31],[6,-22],[11,-4],[5,-3],[2,-19]],dark);
      P([[-7,-42],[-5,-51],[0,-56],[5,-50],[8,-43],[4,-40],[-4,-40]],dark);
      P([[-6,-44],[-4,-50],[0,-55],[2,-49],[0,-45],[-4,-43]],lit);
      P([[-2,-49],[4,-47],[5,-43],[1,-41],[-2,-43]],shadow);R(1,-47,3,1,glow);
      P([[-7,-35],[-15,-28],[-13,-24],[-3,-31]],lit);P([[6,-34],[13,-29],[12,-25],[5,-29]],mid);
      R(-4,-22,9,2,bronze);R(-1,-22,2,2,gold);
      R(16,-49,3,49,shadow);R(16,-48,1,47,bronze);R(17,-46,1,44,gold);
      P([[17,-57],[22,-52],[17,-47],[12,-52]],bronze);P([[17,-55],[20,-52],[17,-49],[14,-52]],glow);
      const by=-32-(awakening&&!reducedMotion?Math.round(Math.sin(progress*Math.PI)*4):0);
      P([[-23,by],[-16,by-3],[-8,by],[-8,by+9],[-16,by+7],[-23,by+9]],shadow);
      P([[-22,by],[-16,by-2],[-9,by],[-9,by+7],[-16,by+5],[-22,by+7]],bronze);
      P([[-21,by+1],[-16,by-1],[-16,by+5],[-21,by+6]],edge);
      P([[-15,by-1],[-10,by+1],[-10,by+6],[-15,by+4]],lit);
      R(-16,by,1,5,shadow);R(-20,by+2,3,1,dark);R(-14,by+2,3,1,dark);
    }
    // Sparse weathered stone chips.
    R(-7,-17,2,1,'#52685e');R(4,-10,1,2,'#3d514c');R(-6,-5,2,1,'#84958a');
    if(awakening){
      ctx.save();ctx.globalAlpha=.12+flash*.22;disc(x,base-37,22+flash*13,accent);ctx.restore();
      ring(x,base-36,16+progress*31,accent,1.5);
      for(let i=0;i<18;i++){const q=i*2.39996+progress*5,r=12+(i*17)%25+progress*7;
        R0(Math.cos(q)*r,-12-progress*74+(i*13)%25,i%4===0?2:1,i%4===0?2:1,accent);}
    }
    const sy=base-84;
    if(attuned||awakening){
      ctx.save();ctx.globalAlpha=awakening?Math.max(.15,progress):.85;
      ring(x,sy,13+flash*4,accent,1);
      if(item.classId==='warden')poly([[x,sy-7],[x+6,sy-4],[x+5,sy+4],[x,sy+7],[x-5,sy+4],[x-6,sy-4]],accent);
      else if(item.classId==='wayfarer')poly([[x-7,sy+6],[x+6,sy-6],[x+7,sy-1],[x+4,sy-3],[x-5,sy+7]],accent);
      else gem(x,sy,7,accent);
      ctx.restore();
    }
    R0(-36,-116,72,11,shadow);R0(-36,-116,72,1,bronze);
    if(typeof ctx.fillText==='function'){ctx.save();ctx.font='bold 7px serif';ctx.textAlign='center';ctx.fillStyle=C.gilt;ctx.fillText(item.name.toUpperCase(),x,base-108);ctx.restore();}
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
