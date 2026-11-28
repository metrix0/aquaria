import { TILE } from './world/generation.js';
import { STATUE_AWAKEN_SECONDS, sanctuaryLightLevel, sanctuaryBrazierLevel } from './world/water-temple-interior.js';

// Player-scale sculptures with directional stone facets and recessed architectural depth.
const C = { black:'#101922', dark:'#243543', stone:'#435962', mid:'#637d82', light:'#91a3a0',
  pale:'#b4c4bc', gold:'#a88b60', gilt:'#dbc498', recess:'#182731', floor:'#30454b' };
const clamp = x => Math.max(0,Math.min(1,x));

export function drawClassChamber(ctx, world, bounds, time, activeClass, reducedMotion) {
  const statues = world.items.filter(item => item.kind === 'class-statue');
  const floor = statues[0].floor * TILE;
  const illumination = sanctuaryLightLevel(world);
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
  const line = (points,color,width=1) => {
    if(!visible(Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))))return;
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  const beam = (x,y,w,h,color,alpha=.11) => {
    ctx.save();ctx.globalAlpha=alpha;poly([[x-w,y],[x+w,y],[x+w*.23,y-h],[x-w*.23,y-h]],color);ctx.restore();
  };
  const diamond=(x,y,r,color)=>poly([[x,y-r],[x+r,y],[x,y+r],[x-r,y]],color);
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
    for(const s of [-1,1])for(let j=0;j<7;j++){
      const f=(j+.5)/7,xx=cx+s*a*f,yy=top+(f<.66?f/.66*28:28+(f-.66)/.34*47);
      line([[xx,yy],[xx+s*6,yy+8]],'#657b79',1);
    }
    gem(cx,top+16,11,C.gold);
    rect(cx-a+6,top+80,3,h-80,C.gold);
    rect(cx+a-9,top+80,3,h-80,C.gold);
  }
  function column(x,base,h) {
    rect(x-18,base-8,36,8,C.mid);rect(x-14,base-h,28,h-8,C.stone);
    rect(x-13,base-h+14,5,h-26,C.light);
    for(const dx of [-5,3,10])rect(x+dx,base-h+18,3,h-30,C.dark);
    for(let y=base-h+29;y<base-20;y+=21){
      rect(x-13,y,26,1,'#23363d');rect(x-12,y+1,11,1,'#86958b');
    }
    cornice(x-17,base-h,34);
    poly([[x-20,base-h+14],[x+20,base-h+14],[x+12,base-h+25],[x-12,base-h+25]],C.mid);
    rect(x-23,base-20,46,4,C.stone);rect(x-20,base-16,40,2,C.gilt);
    rect(x-24,base-6,48,6,C.dark);rect(x-24,base-6,48,1,C.light);
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
  // Recessed side aisles, framing the ancient triptych with structural depth.
  for(const cx of [104,world.cols*TILE-104]){
    ctx.save();ctx.globalAlpha=.52;
    arch(cx,floor-9,92,floor-88);
    column(cx-49,floor,floor-76);column(cx+49,floor,floor-76);
    ctx.restore();
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
  // Great carved celestial seal above the three oaths, with a deeply inset
  // wheel, radiating ribs, and antique bronze inlays.
  const crestY=floor-207;
  disc(center,crestY,45,'#182c33');disc(center,crestY,42,'#67796f');
  disc(center,crestY,37,'#263b43');
  ring(center,crestY,32,'#9a9f83',2);ring(center,crestY,26,'#596d64',1);
  for(let j=0;j<12;j++){
    const q=j*Math.PI/6;
    line([[center+Math.cos(q)*29,crestY+Math.sin(q)*29],[center+Math.cos(q)*39,crestY+Math.sin(q)*39]],'#b0aa88',2);
    diamond(center+Math.cos(q)*23,crestY+Math.sin(q)*23,2,'#82978b');
  }
  diamond(center,crestY,15,'#718e83');
  diamond(center,crestY,10,illumination>0?'#98c9be':'#405c59');
  if(illumination>0){
    ctx.save();ctx.globalAlpha=.14*illumination;
    disc(center,crestY,30,'#96ebdd');ctx.restore();
    beam(center,floor-2,span*.62,floor-58,'#9abdb8',illumination*.065);
  }
  // Continuous recessed frieze and stepped stone altar across all three bays.
  rect(center-span/2-46,floor-150,span+92,13,'#24363e');
  rect(center-span/2-46,floor-150,span+92,2,'#7b8c85');
  for(let x=center-span/2-40;x<center+span/2+42;x+=16){
    poly([[x,floor-145],[x+6,floor-141],[x+12,floor-145],[x+6,floor-148]],'#667a75');
  }
  rect(center-span/2-42,floor-5,span+84,5,'#425b60');
  rect(center-span/2-42,floor-6,span+84,1,'#85958a');
  // Stone ribs between the three niches; the arch stays a single monument.
  for(const cx of [center-span/4,center+span/4]){
    rect(cx-5,floor-136,10,130,'#263e44');
    rect(cx-5,floor-136,2,130,'#819389');
    rect(cx+3,floor-136,2,130,'#182a30');
    rect(cx-8,floor-138,16,4,'#87978b');
    rect(cx-9,floor-7,18,7,'#546c68');
  }
  for(const item of statues) {
    if(!visible(item.x-60,120))continue;
    const x=item.x, base=item.floor*TILE, accent=item.accent;
    const awakening=world.statueAwakening?.id===item.id?world.statueAwakening:null;
    const progress=awakening?clamp(awakening.elapsed/STATUE_AWAKEN_SECONDS):0;
    const flash=awakening?Math.sin(Math.PI*progress):0;
    const attuned=illumination>0 && activeClass===item.classId;
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
    for(let i=0;i<8;i++){
      const q=i*Math.PI/4;
      R0(Math.cos(q)*20-1,-84+Math.sin(q)*20-1,2,2,bronze);
    }
    // Carved wedge blocks and fine chisel lines around the apses.
    for(let i=0;i<4;i++){
      const d=i*8;
      line([[x-42+d,base-94-d],[x-47+d,base-97-d]],'#80968a');
      line([[x+42-d,base-94-d],[x+47-d,base-97-d]],'#344b4e');
    }
    for(const s of [-1,1]){
      R0(s*34-2,-78,4,58,'#3b5152');
      R0(s*34-2,-78,1,58,'#71877e');
      R0(s*34-4,-80,8,3,bronze);
    }
    // Three-dimensional plinth: top, front, side and contact shadow.
    P0([[-25,-3],[18,-3],[27,0],[-17,0]],'#111b20');
    P0([[-24,-11],[18,-11],[25,-8],[-18,-8]],lit);
    R0(-18,-8,43,8,dark);R0(-18,-8,43,1,edge);
    P0([[18,-11],[25,-8],[25,0],[18,-3]],shadow);
    R0(-15,-5,32,3,mid);R0(-13,-4,28,1,bronze);

    const b=base-11;
    const R=(dx,dy,w,h,c)=>rect(x+dx,b+dy,w,h,c);
    const P=(pts,c)=>poly(pts.map(([dx,dy])=>[x+dx,b+dy]),c);
    // Chiseled sacred effigies, with ritual weapons and finely carved stone.
    const rune = attuned || awakening ? accent : '#8a9e91';
    const notch = (dx,dy) => {R(dx,dy,1,3,shadow);R(dx+1,dy+2,2,1,dark);};
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
      // Armored sentinel with a heavy crescent-bladed ceremonial axe.
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
      P([[-14,-36],[-10,-41],[-6,-40],[-8,-35],[-13,-32]],dark);
      P([[-14,-36],[-10,-40],[-7,-39],[-9,-36]],edge);
      P([[7,-41],[13,-39],[15,-34],[10,-32],[7,-36]],dark);
      R(9,-39,4,1,lit);
      P([[-6,-37],[0,-39],[5,-36],[0,-32],[-6,-34]],dark);
      P([[-3,-36],[0,-38],[3,-36],[0,-34]],rune);
      R(-6,-29,12,1,lit);R(-5,-22,10,1,edge);
      R(-7,-19,4,1,lit);R(3,-19,4,1,mid);
      // Planted haft, pronounced blade bevel, and gripping gauntlet.
      R(13,-51,3,51,shadow);R(13,-50,1,49,lit);
      P([[13,-52],[23,-56],[25,-55],[23,-48],[25,-40],[22,-38],[13,-43]],shadow);
      P([[14,-51],[23,-55],[23,-50],[21,-48],[23,-41],[22,-40],[14,-44]],mid);
      P([[23,-55],[22,-49],[21,-48],[23,-41],[22,-40],[24,-40],[24,-47]],edge);
      P([[10,-51],[5,-54],[3,-51],[5,-45],[10,-45],[13,-48]],dark);
      R(8,-51,5,1,lit);R(14,-48,4,1,rune);
      P([[8,-34],[12,-28],[15,-27],[16,-30],[12,-31]],mid);
      R(13,-29,4,3,lit);R(13,-28,3,1,edge);
      notch(19,-50);notch(-7,-34);
      // Engraved armor plates, chiselled relief and an ancient shield boss.
      for(let j=0;j<3;j++){
        R(-6,-20+j*4,4,1,lit);R(3,-20+j*4,4,1,mid);
      }
      P([[-4,-41],[0,-43],[4,-41],[0,-39]],edge);
      // Narrow shield leaning against the plinth.
      P([[-20,-30],[-13,-33],[-8,-30],[-9,-15],[-14,-8],[-20,-15]],shadow);
      P([[-19,-29],[-13,-31],[-10,-28],[-11,-16],[-14,-11],[-18,-16]],mid);
      P([[-19,-29],[-13,-31],[-14,-14],[-18,-16]],lit);
      R(-14,-28,1,13,edge);
      P([[-17,-23],[-14,-26],[-11,-23],[-14,-19]],dark);
      P([[-16,-23],[-14,-25],[-12,-23],[-14,-21]],rune);
    }else if(item.classId==='wayfarer'){
      // Blade pilgrim with a wind-worn mantle, long sword and recurved bow.
      robes(13,-1);head(true);
      P([[-7,-41],[-12,-37],[-15,-25],[-18,-6],[-15,-3],[-10,-18],[-8,-31]],dark);
      P([[-10,-37],[-13,-28],[-15,-13],[-15,-8],[-12,-18],[-9,-32]],lit);
      P([[-7,-37],[-4,-39],[7,-26],[5,-24]],bronze);
      P([[-9,-41],[-14,-39],[-20,-29],[-23,-9],[-19,-2],[-14,-11],[-12,-27]],shadow);
      P([[-12,-38],[-16,-29],[-20,-11],[-19,-6],[-16,-15],[-14,-27]],mid);
      P([[-15,-31],[-17,-19],[-20,-9],[-19,-16]],lit);
      P([[-5,-40],[-2,-39],[-4,-36],[-7,-37]],rune);
      P([[8,-37],[12,-32],[16,-30],[16,-27],[7,-29]],mid);
      // Long stone sword pointing down, with a fuller, quillons and pommel.
      P([[13,-25],[19,-25],[19,-4],[16,0],[13,-4]],shadow);
      P([[14,-24],[18,-24],[18,-5],[16,-2],[14,-5]],mid);
      R(14,-24,1,19,edge);R(16,-23,1,19,dark);
      P([[9,-27],[23,-27],[22,-24],[17,-25],[15,-25],[10,-24]],lit);
      R(15,-35,3,8,dark);R(15,-34,1,6,bronze);
      P([[14,-36],[16,-39],[19,-36],[18,-34],[15,-34]],mid);
      R(13,-32,5,3,lit);R(14,-32,3,1,edge);
      // Left hand carries a tall recurve, with a taut string and carved grip.
      P([[-16,-56],[-21,-53],[-24,-46],[-26,-36],[-26,-25],[-23,-15],[-20,-8],[-16,-5],[-18,-12],[-21,-20],[-22,-30],[-21,-40],[-19,-49]],shadow);
      P([[-16,-56],[-20,-52],[-23,-45],[-25,-36],[-25,-26],[-22,-15],[-19,-8],[-16,-5],[-18,-11],[-21,-20],[-23,-30],[-22,-40],[-20,-49]],mid);
      P([[-16,-56],[-21,-52],[-24,-45],[-25,-36],[-24,-26],[-22,-16],[-20,-9],[-22,-18],[-25,-27],[-26,-36],[-24,-46],[-21,-53]],lit);
      R(-17,-55,1,49,bronze);
      R(-26,-34,5,7,dark);R(-25,-33,2,5,edge);
      P([[-10,-38],[-13,-33],[-23,-32],[-23,-28],[-12,-29],[-7,-33]],mid);
      P([[-11,-36],[-14,-32],[-22,-32],[-22,-30],[-13,-30]],lit);
      R(-25,-32,4,4,mid);R(-25,-32,2,1,edge);
      notch(-16,-16);notch(16,-14);
    }else{
      // Scholar in long temple vestments, bowed head, staff and an open stone codex.
      robes(16,1);head(true);
      P([[-7,-41],[-2,-38],[0,-29],[2,-38],[7,-41],[5,-35],[0,-26],[-5,-35]],bronze);
      P([[-9,-36],[-15,-29],[-14,-23],[-7,-30]],lit);
      P([[8,-37],[13,-32],[15,-26],[12,-24],[7,-30]],dark);
      R(13,-28,4,3,mid);
      // Engraved ritual vestments and a crescent scepter enclosing a crystal.
      P([[-7,-40],[-4,-38],[-6,-26],[-10,-13],[-12,-12],[-8,-26]],lit);
      P([[5,-40],[8,-38],[7,-25],[12,-13],[9,-12],[4,-25]],dark);
      for(let j=0;j<3;j++){R(-8+j,-31+j*5,2,1,bronze);R(5+j,-31+j*5,2,1,bronze);}
      R(-13,-3,25,1,lit);
      R(17,-49,3,49,shadow);R(17,-48,1,47,lit);
      P([[17,-49],[12,-53],[11,-57],[14,-57],[14,-54],[18,-51],[22,-54],[22,-57],[25,-57],[24,-52],[20,-49]],mid);
      P([[12,-57],[14,-57],[14,-54],[18,-51],[17,-50],[13,-53]],edge);
      P([[18,-57],[21,-54],[18,-51],[15,-54]],rune);
      R(16,-45,5,2,bronze);R(16,-9,5,2,bronze);notch(17,-19);
      const by=-29-(awakening&&!reducedMotion?Math.round(Math.sin(progress*Math.PI)*4):0);
      P([[-22,by],[-15,by-3],[-8,by],[-8,by+8],[-15,by+6],[-22,by+8]],shadow);
      P([[-21,by],[-15,by-2],[-9,by],[-9,by+6],[-15,by+4],[-21,by+6]],lit);
      R(-15,by-1,1,6,dark);R(-20,by+2,3,1,dark);R(-13,by+2,3,1,dark);
    }
    // Fine eroded chisel marks and subdued decorative pedestal inlays.
    R(-4,-35,2,1,edge);R(4,-18,1,2,dark);
    R0(-16,-3,32,1,'#253c40');
    for(const d of [-12,12])R0(d,-6,2,2,'#819389');
    // Sparse weathered stone chips.
    R(-7,-17,2,1,'#52685e');R(4,-10,1,2,'#3d514c');R(-6,-5,2,1,'#84958a');
    notch(-5,-12);
    P0([[-4,-6],[0,-8],[4,-6],[0,-3]],rune);
    if(awakening){
      ctx.save();ctx.globalAlpha=.12+flash*.22;disc(x,base-37,22+flash*13,accent);ctx.restore();
      ring(x,base-36,16+progress*31,accent,1.5);
      // Concentric ritual wave, luminous fractures, and a rising column of light.
      ctx.save();ctx.globalAlpha=.42*flash;
      ring(x,base-36,24+progress*51,accent,1);
      beam(x,base-6,19,105,accent,.19*flash);
      for(let j=0;j<5;j++){
        const yy=base-8-j*17;
        diamond(x+(j%2?11:-10),yy,2,accent);
      }
      ctx.restore();
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
    // Heavy bronze ceremonial fire bowls atop fluted, sculpted stone supports.
    // The bowl remains a convincing unlit fixture, not a triangular torch.
    rect(x-15,y-4,30,4,'#25373e');rect(x-13,y-5,26,2,'#81978a');
    poly([[x-10,y-5],[x-7,y-17],[x-10,y-23],[x+10,y-23],[x+7,y-17],[x+10,y-5]],'#405b5d');
    poly([[x-10,y-5],[x-7,y-17],[x-10,y-23],[x-4,y-23],[x-2,y-16],[x-5,y-5]],'#789287');
    rect(x+3,y-19,3,12,'#293f43');
    poly([[x-17,y-29],[x-14,y-24],[x-8,y-20],[x+8,y-20],[x+14,y-24],[x+17,y-29]],'#645d48');
    poly([[x-17,y-29],[x-14,y-24],[x-8,y-20],[x-3,y-20],[x-8,y-24],[x-11,y-29]],'#c2a879');
    rect(x-18,y-30,36,3,'#9f906c');rect(x-14,y-29,28,1,'#253638');
    diamond(x,y-23,3,'#a4ae95');rect(x-8,y-7,16,1,'#a8ac8e');
    const strength=sanctuaryBrazierLevel(world,tx);
    if(strength<=0)continue;
    const sway=reducedMotion?0:Math.sin(time*3.1+x)*2.5;
    const h=(18+(reducedMotion?0:Math.sin(time*5.1+x)*3))*strength;
    const fy=y-30;
    ctx.save();ctx.globalAlpha=strength*.23;
    disc(x,fy-7,17+4*strength,'#57b4bc');ctx.restore();
    ctx.save();ctx.globalAlpha=strength;
    // Layered branching tongues, curved silhouettes and white-hot cores.
    poly([[x-12,fy],[x-10,fy-h*.30],[x-13+sway,fy-h*.60],[x-6,fy-h*.48],[x-3+sway,fy-h*.94],[x+1,fy-h*.58],[x+6+sway,fy-h],[x+7,fy-h*.40],[x+12,fy-h*.54],[x+11,fy]],'#43868f');
    poly([[x-9,fy],[x-7,fy-h*.28],[x-3+sway,fy-h*.67],[x,fy-h*.35],[x+4+sway,fy-h*.82],[x+6,fy-h*.26],[x+10,fy]],'#79cbd1');
    poly([[x-6,fy],[x-3,fy-h*.27],[x+sway,fy-h*.55],[x+2,fy-h*.29],[x+5,fy-h*.47],[x+7,fy]],'#d4efe4');
    rect(x-8,fy,16,1,'#a6e3dd');
    if(!reducedMotion)for(let j=0;j<3;j++){
      const p=(time*.55+j*.32+tx*.13)%1;
      rect(x+Math.sin(j*3+time)*6,fy-h-p*14,1,1,'#c4f1e6');
    }
    ctx.restore();
  }
}
