import { TILE } from './world/generation.js';
import { STATUE_AWAKEN_SECONDS } from './world/water-temple-interior.js';

// Player-scale sculptures with directional stone facets and recessed architectural depth.
const C = { black:'#101922', dark:'#243543', stone:'#435962', mid:'#637d82', light:'#91a3a0',
  pale:'#b4c4bc', gold:'#a88b60', gilt:'#dbc498', recess:'#182731', floor:'#30454b' };
const clamp = x => Math.max(0,Math.min(1,x));

export function drawClassChamber(ctx, world, bounds, time, activeClass, reducedMotion) {
  const statues = world.items.filter(item => item.kind === 'class-statue');
  const floor = statues[0].floor * TILE;
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
  // One continuous sanctuary, not three unrelated display stands.
  const center = statues[1].x;
  const span = statues[2].x - statues[0].x;
  ctx.save();ctx.globalAlpha=.76;
  arch(center,floor-7,span+114,floor-65);
  column(center-span/2-62,floor,floor-55);
  column(center+span/2+62,floor,floor-55);
  ctx.restore();
  // Continuous recessed frieze and stepped stone altar across all three bays.
  rect(center-span/2-46,floor-150,span+92,13,'#24363e');
  rect(center-span/2-46,floor-150,span+92,2,'#7b8c85');
  for(let x=center-span/2-40;x<center+span/2+42;x+=16){
    poly([[x,floor-145],[x+6,floor-141],[x+12,floor-145],[x+6,floor-148]],'#667a75');
  }
  rect(center-span/2-42,floor-5,span+84,5,'#425b60');
  rect(center-span/2-42,floor-6,span+84,1,'#85958a');
  for(const item of statues) {
    if(!visible(item.x-60,120))continue;
    const x=item.x, base=item.floor*TILE, accent=item.accent;
    const awakening=world.statueAwakening?.id===item.id?world.statueAwakening:null;
    const progress=awakening?clamp(awakening.elapsed/STATUE_AWAKEN_SECONDS):0;
    const flash=awakening?Math.sin(Math.PI*progress):0;
    const attuned=activeClass===item.classId;
    // Three narrow apses carved into the same ancient sanctuary wall.
    const shadow='#17282e', dark='#334b50', mid='#54716f', lit='#819c90', edge='#a8b8a6';
    const bronze='#6a837a', gold='#a2b1a0', glow=attuned||awakening?accent:dark;
    const P0=(pts,c)=>poly(pts.map(([dx,dy])=>[x+dx,base+dy]),c);
    const R0=(dx,dy,w,h,c)=>rect(x+dx,base+dy,w,h,c);
    P0([[-49,-4],[-49,-91],[-32,-115],[0,-136],[32,-115],[49,-91],[49,-4]],'#50636a');
    P0([[-44,-4],[-44,-89],[-28,-111],[0,-128],[28,-111],[44,-89],[44,-4]],shadow);
    P0([[-44,-89],[-40,-85],[-40,-5],[-44,-4]],'#607b75');
    P0([[44,-89],[40,-85],[40,-5],[44,-4]],dark);
    for(let j=-80;j<-8;j+=14){R0(-40,j,80,1,'#293941');R0(-40,j+1,80,1,'#35484a');}
    disc(x,base-84,22,'#253d43');ring(x,base-84,21,'#536d66',1);
    ring(x,base-84,16,'#405553',1);
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
    // Elongated, human-proportioned funerary sculptures: narrow faces,
    // measured poses and long carved folds instead of oversized character heads.
    function head(hood=false) {
      if(hood){
        P([[-7,-45],[-6,-51],[-3,-56],[2,-56],[6,-52],[8,-45],[5,-42],[-5,-42]],shadow);
        P([[-6,-46],[-5,-52],[-2,-56],[1,-55],[0,-50],[-3,-45]],lit);
      }else{
        P([[-5,-47],[-4,-53],[-1,-56],[3,-55],[5,-52],[5,-46],[2,-43],[-3,-44]],dark);
        P([[-4,-51],[-2,-55],[1,-55],[2,-50],[-2,-48]],lit);
      }
      P([[-3,-51],[1,-53],[4,-51],[4,-47],[1,-44],[-3,-46]],mid);
      R(-3,-50,2,1,shadow);R(2,-50,2,1,shadow);
      R(0,-49,1,3,lit);R(-1,-46,3,1,dark);
      if(awakening||attuned) {R(-3,-50,2,1,glow);R(2,-50,2,1,glow);}
      R(-2,-44,5,3,dark);
    }
    function robes(width, lean=0){
      P([[-7,-42],[7,-42],[11,-35],[7,-22],[width-2,0],[-width,0],[-8,-23],[-11,-35]],shadow);
      P([[-7,-41],[-2,-39],[-1,-24],[-width+3,-2],[-width+9,-2],[2,-20],[5,-40]],mid);
      P([[5,-41],[10,-35],[6,-23],[width-3,-2],[width-8,-2],[2,-23]],dark);
      P([[-5,-36],[-3,-26],[-9,-8],[-width+5,-2],[-width+7,-12],[-5,-25]],lit);
      for(let i=0;i<3;i++){
        P([[lean-2+i*3,-23],[lean+i*3,-21],[lean-5+i*5,-3],[lean-7+i*5,-3]],i===0?lit:dark);
      }
      R(-5,-23,10,2,bronze);R(-1,-23,2,2,edge);
    }
    if(item.classId==='warden'){
      // Solemn sentinel resting both gauntlets over the pommel of a grounded sword.
      P([[-9,-41],[-5,-43],[5,-43],[10,-39],[13,-34],[10,-24],[7,-17],[8,0],[-8,0],[-7,-17],[-12,-33]],shadow);
      P([[-8,-40],[-4,-42],[3,-41],[6,-35],[4,-23],[-6,-23],[-9,-34]],mid);
      P([[3,-41],[9,-38],[11,-33],[8,-25],[4,-23],[6,-35]],dark);
      P([[-12,-36],[-9,-40],[-4,-37],[-6,-32],[-13,-32]],lit);
      P([[7,-40],[12,-36],[12,-32],[7,-32]],dark);
      P([[-5,-38],[2,-38],[4,-31],[0,-29],[-5,-31]],lit);
      R(-6,-26,12,2,bronze);R(-5,-23,10,2,dark);
      P([[-7,-21],[-2,-21],[-3,-4],[-8,-4]],mid);
      P([[2,-21],[7,-21],[8,-4],[3,-4]],dark);
      R(-9,-4,7,4,dark);R(2,-4,8,4,dark);R(-8,-3,5,1,lit);
      head();
      // Ancient helmet ridge and cheek guards, no cartoon visor.
      P([[-5,-52],[-4,-56],[0,-57],[3,-56],[4,-53],[0,-54]],lit);
      R(-5,-50,1,5,dark);R(4,-50,1,5,dark);
      P([[-11,-32],[-9,-27],[-3,-23],[-1,-25],[-7,-30]],mid);
      P([[11,-32],[9,-27],[3,-23],[1,-25],[7,-30]],dark);
      R(-4,-26,8,3,lit);R(-6,-23,12,2,bronze);
      P([[-2,-21],[2,-21],[2,-3],[0,0],[-2,-3]],dark);
      R(-1,-20,1,17,edge);
      // Narrow shield leaning against the plinth.
      P([[-20,-30],[-13,-33],[-8,-30],[-9,-15],[-14,-8],[-20,-15]],shadow);
      P([[-19,-29],[-13,-31],[-10,-28],[-11,-16],[-14,-11],[-18,-16]],mid);
      P([[-19,-29],[-13,-31],[-14,-14],[-18,-16]],lit);
      R(-14,-28,1,13,edge);
    }else if(item.classId==='wayfarer'){
      // Standing pilgrim, travel cloak and an unstrung-looking tall recurve.
      robes(13,-1);head(true);
      P([[-7,-41],[-12,-37],[-15,-25],[-18,-6],[-15,-3],[-10,-18],[-8,-31]],dark);
      P([[-10,-37],[-13,-28],[-15,-13],[-15,-8],[-12,-18],[-9,-32]],lit);
      P([[-7,-37],[-4,-39],[7,-26],[5,-24]],bronze);
      P([[8,-37],[12,-32],[16,-27],[14,-24],[7,-29]],mid);
      R(13,-28,4,3,lit);
      P([[18,-51],[22,-44],[23,-33],[23,-19],[21,-10],[17,-3],[19,-13],[20,-23],[20,-37],[19,-45]],dark);
      P([[18,-51],[21,-44],[22,-33],[22,-19],[20,-10],[17,-3],[19,-12],[21,-23],[21,-37]],lit);
      R(17,-49,1,45,bronze);
      P([[-11,-39],[-14,-47],[-10,-48],[-6,-40]],dark);
      R(-13,-47,1,8,edge);
    }else{
      // Scholar in long temple vestments, bowed head, staff and an open stone codex.
      robes(16,1);head(true);
      P([[-7,-41],[-2,-38],[0,-29],[2,-38],[7,-41],[5,-35],[0,-26],[-5,-35]],bronze);
      P([[-9,-36],[-15,-29],[-14,-23],[-7,-30]],lit);
      P([[8,-37],[13,-32],[15,-26],[12,-24],[7,-30]],dark);
      R(13,-28,4,3,mid);
      R(17,-51,3,51,dark);R(17,-50,1,48,lit);
      P([[18,-57],[23,-52],[18,-47],[13,-52]],dark);
      P([[18,-55],[21,-52],[18,-49],[15,-52]],attuned||awakening?accent:mid);
      const by=-29-(awakening&&!reducedMotion?Math.round(Math.sin(progress*Math.PI)*4):0);
      P([[-22,by],[-15,by-3],[-8,by],[-8,by+8],[-15,by+6],[-22,by+8]],shadow);
      P([[-21,by],[-15,by-2],[-9,by],[-9,by+6],[-15,by+4],[-21,by+6]],lit);
      R(-15,by-1,1,6,dark);R(-20,by+2,3,1,dark);R(-13,by+2,3,1,dark);
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
    // No nameplates: the silhouette and carved equipment identify the class.
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
