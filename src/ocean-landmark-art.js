// Submerged architecture and fossil silhouettes. All dimensions below are
// local pixel-art units; the world provides a full seabed profile per site.
const stone = ['#182f37','#304c51','#4a6868','#76918a','#a0b0a0'];
const bone = ['#34464a','#586a67','#87978a','#b0bca4','#d4d5b6'];
const reef = ['#513b59','#996b82','#bd8a91','#dfa9a0'];
const kelp = ['#244d4d','#386e60','#57927a','#81ad88'];
const rand = (n,s=0) => { const v = Math.sin(n*79.17+s*23.49)*43758.5453; return v-Math.floor(v); };

export function landmarkFloorAt(item, worldX) {
  const i = Math.floor(worldX / item.tile) - item.floorStart;
  return item.floorProfile[Math.max(0,Math.min(item.floorProfile.length-1,i))];
}

// Split each painted strip at terrain tile boundaries. Buried bones and
// masonry disappear under the seabed rather than painting over solid blocks.
function terrainPainter(rect,item) {
  return (x,y,w,h,color) => {
    const end=x+w;
    for(let left=x;left<end;) {
      const right=Math.min(end,(Math.floor(left/item.tile)+1)*item.tile);
      const bottom=Math.min(y+h,landmarkFloorAt(item,left));
      if(bottom>y && right>left) rect(left,y,right-left,bottom-y,color);
      if(right<=left) break;
      left=right;
    }
  };
}

// Pixel-stepped filled polygon, layered rather than outlined with disconnected
// squares. A two-unit raster preserves the game's low-resolution art style.
function poly(rect,points,color,step=2) {
  const lo=Math.floor(Math.min(...points.map(p=>p[1]))/step)*step;
  const hi=Math.ceil(Math.max(...points.map(p=>p[1]))/step)*step;
  for(let y=lo;y<hi;y+=step) {
    const scan=y+step*.5, xs=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      if((a[1]<=scan&&b[1]>scan)||(b[1]<=scan&&a[1]>scan)) xs.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2) {
      const x=Math.floor(xs[i]/step)*step, end=Math.ceil(xs[i+1]/step)*step;
      if(end>x) rect(x,y,end-x,step,color);
    }
  }
}

function ribbon(rect,pts,width,palette=bone) {
  function shape(mult,offset) {
    const a=[],b=[];
    pts.forEach(([x,y],i)=>{
      const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)];
      const dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy)||1;
      const t=i/(pts.length-1), w=width*(.36+.64*Math.sin(Math.PI*t)**.65)*mult;
      const nx=-dy/len,ny=dx/len;
      a.push([x+nx*w+offset,y+ny*w+offset]);b.push([x-nx*w+offset,y-ny*w+offset]);
    });
    return a.concat(b.reverse());
  }
  poly(rect,shape(1,0),palette[0]);
  poly(rect,shape(.76,-.7),palette[2]);
  poly(rect,shape(.34,-1.2),palette[3]);
}

function masonry(rect,x,y,w,h,seed) {
  if(w<5||h<5) {rect(x,y,w,h,stone[1]);return;}
  rect(x,y,w,h,stone[0]);
  rect(x+1,y+1,w-2,h-2,stone[1+Math.floor(rand(seed)*2)]);
  rect(x+2,y+1,w-4,2,stone[3]);
  rect(x+w-3,y+3,2,h-4,stone[0]);
  if(rand(seed,5)>.48) {
    rect(x+w*.4,y+3,2,Math.max(1,h-5),stone[0]);
    rect(x+w*.4-3,y+h-3,5,1,stone[0]);
  }
  if(rand(seed,1)>.55) rect(x+3,y+2,Math.min(w-4,5+rand(seed,2)*11),2,kelp[2]);
}
function courses(rect,x,y,w,h,seed) {
  for(let row=0;row<h;row+=10) {
    const bh=Math.min(10,h-row);
    for(let dx=0;dx<w;) {
      const bw=Math.min(w-dx,dx===0&&row%20?9:18);
      masonry(rect,x+dx,y+row,bw,bh,seed+row*7+dx);dx+=bw;
    }
  }
}
function pillar(rect,x,base,h,seed,width=20,broken=false) {
  masonry(rect,x-width*.8,base-9,width*1.6,9,seed);
  masonry(rect,x-width*.65,base-15,width*1.3,6,seed+1);
  for(let rise=15;rise<h;rise+=11) {
    const lean=Math.round((rand(seed,3)-.5)*rise*.05);
    const bh=Math.min(11,h-rise);
    masonry(rect,x-width/2+lean,base-rise-bh,width,bh,seed+rise);
    if(bh>5) for(let f=-1;f<=1;f++) rect(x+f*width*.24+lean,base-rise-bh+2,2,bh-4,stone[3]);
  }
  if(!broken) {
    masonry(rect,x-width*.65,base-h-6,width*1.3,6,seed+2);
    masonry(rect,x-width*.85,base-h-12,width*1.7,6,seed+3);
  }
}
function vine(rect,x,y,h,seed,time,hang=false) {
  for(let j=0;j<h;j+=3) {
    const sway=Math.sin(j*.11+seed+time*.8)*Math.min(12,j*.14);
    const px=x+sway, py=y+(hang?j:-j);
    rect(px,py,3,4,kelp[1]);
    if(j%9===0) {
      const d=(j%18===0?1:-1);
      rect(px+(d<0?-9:2),py-1,10,3,kelp[2]);
      rect(px+(d<0?-7:3),py-3,6,2,kelp[3]);
    }
  }
}

function arch(rect,cx,base,width,height,seed,broken=false) {
  const rx=width/2, ry=height, spring=base-height*.66;
  // Stone voussoirs form a true open arch with a continuous stone rim.
  for(let i=0;i<22;i++) {
    if(broken&&i>=9&&i<=14) continue;
    const t0=Math.PI*i/22,t1=Math.PI*(i+1)/22;
    const ring=(t,outer)=>[cx+Math.cos(t)*(rx+(outer?12:0)),spring-Math.sin(t)*(ry*.44+(outer?12:0))];
    const pts=[ring(t0,false),ring(t1,false),ring(t1,true),ring(t0,true)];
    poly(rect,pts,stone[0]);
    const tm=(t0+t1)/2;
    const inner=ring(tm,false),outer=ring(tm,true);
    ribbon(rect,[inner,outer],3,[stone[0],stone[1],stone[2+(i%2)],stone[3]]);
  }
  pillar(rect,cx-rx-7,base,height*.66,seed,15);
  pillar(rect,cx+rx+7,base,height*.66,seed+7,15);
}
function relief(rect,x,y,seed) {
  // Ancient carved sea guardian, weathered crown, eyes and central trident.
  poly(rect,[[x-16,y-18],[x-7,y-25],[x+7,y-25],[x+16,y-18],[x+14,y+12],[x,y+23],[x-14,y+12]],stone[0]);
  poly(rect,[[x-12,y-17],[x,y-21],[x+12,y-17],[x+10,y+9],[x,y+18],[x-10,y+9]],stone[2]);
  rect(x-9,y-5,6,3,stone[0]);rect(x+3,y-5,6,3,stone[0]);
  rect(x-1,y-5,3,12,stone[3]);rect(x-6,y+11,12,2,stone[0]);
  if(seed%2) rect(x-4,y-19,8,3,'#6cae9e');
}
function ruin(rect,floor,v,time) {
  // A level deck on masonry piers follows terrain rather than hanging above it.
  const deck=Math.min(...Array.from({length:13},(_,i)=>floor(-132+i*22)))-5;
  for(let dx=-144;dx<144;dx+=12) {
    const bottom=Math.max(floor(dx),floor(dx+11));
    courses(rect,dx,deck,12,Math.max(5,bottom-deck+3),dx+v*71);
  }
  for(let dx=-140;dx<140;dx+=20) masonry(rect,dx,deck-7,20,8,dx+55);
  const base=deck-7;
  if(v===0) {
    // Grand triple arcade: broken side aisles, roof frieze and central idol.
    arch(rect,0,base,86,139,20);
    arch(rect,-92,base,49,88,31,true);
    arch(rect,92,base,49,100,44);
    for(let i=-3;i<=3;i++) masonry(rect,i*20-10,base-164,20,10,i+79);
    relief(rect,0,base-181,1);
    for(let i=-2;i<=2;i++) masonry(rect,i*19-9,base-194+Math.abs(i)*5,19,8,100+i);
  } else if(v===1) {
    // Drowned shrine: colossal facade, recessed door, pilasters and terraces.
    courses(rect,-118,base-142,52,142,29);
    courses(rect,66,base-142,52,142,93);
    for(const dx of [-116,-78,78,116]) pillar(rect,dx,base,156,dx+141,22,dx===116);
    arch(rect,0,base,90,136,60);
    for(let i=-6;i<=6;i++) masonry(rect,i*20-10,base-168,20,12,i+92);
    for(let j=0;j<4;j++) for(let i=-5+j;i<=5-j;i++) {
      if(j>1&&i===3-j) continue;
      masonry(rect,i*20-10,base-180-j*9,20,9,i+120+j*8);
    }
    relief(rect,0,base-186,2);
  } else {
    // Fragmented palace: half an arch, collapsed tower, and leaning lintel.
    courses(rect,-136,base-108,43,108,68);
    pillar(rect,-101,base,139,18,25,true);
    arch(rect,-36,base,78,118,33,true);
    pillar(rect,51,base,91,91,22,true);
    pillar(rect,111,base,52,76,24,true);
    poly(rect,[[42,base-101],[128,base-63],[132,base-51],[38,base-88]],stone[0]);
    poly(rect,[[46,base-99],[125,base-62],[127,base-58],[44,base-92]],stone[3]);
    relief(rect,-115,base-78,3);
  }
  // Fallen masonry follows the seabed independently of the deck.
  for(let i=0;i<18;i++) {
    const px=(rand(i,17+v)-.5)*288,py=floor(px);
    masonry(rect,px,py-5-rand(i,8)*11,8+rand(i,3)*16,6+rand(i,4)*9,i+160);
  }
  for(const [dx,h] of [[-72,62],[-117,34],[65,51],[107,26]]) {
    vine(rect,dx,base-(v===2?67:113),h,dx+v,time,true);
  }
}
function skull(rect,x,y,form,flip) {
  const put=(x0,y0,w,h,c)=>rect(x+flip*(x0+(flip===-1?w:0)),y+y0,w,h,c);
  const shape=(pts,c)=>poly(rect,pts.map(([px,py])=>[x+px*flip,y+py]),c);
  // Skull is an organic stepped profile: brow, sloping snout, cheek and crest.
  const outer=form===1?[[-49,-66],[-39,-86],[-13,-94],[16,-88],[34,-77],[54,-64],[72,-54],[76,-36],[60,-27],[21,-29],[10,-13],[-15,-15],[-36,-27],[-50,-43]]:
    [[-44,-64],[-31,-79],[-8,-85],[17,-81],[37,-69],[60,-61],[66,-46],[60,-34],[20,-31],[8,-18],[-18,-21],[-35,-35],[-45,-46]];
  shape(outer,bone[0]);
  shape(outer.map(([px,py])=>[px*.91,py*.91-3]),bone[2]);
  shape([[-34,-65],[-20,-76],[0,-81],[22,-73],[35,-65],[5,-67],[-10,-61]],bone[3]);
  shape([[-24,-58],[-9,-65],[7,-58],[12,-43],[-1,-34],[-18,-37],[-27,-45]],bone[0]);
  shape([[-20,-55],[-8,-60],[3,-54],[7,-44],[-3,-39],[-16,-42]],'#1f383f');
  shape([[25,-59],[42,-55],[52,-47],[44,-41],[27,-44]],bone[1]);
  shape([[30,-55],[41,-52],[46,-47],[31,-48]],bone[0]);
  // Jaw hinges join the cranium; teeth overlap the jaw rather than floating.
  shape([[-31,-39],[-16,-26],[0,-13],[32,-10],[62,-14],[70,-8],[62,1],[22,3],[-3,-2],[-23,-15],[-39,-29]],bone[0]);
  shape([[-29,-35],[-13,-23],[2,-10],[32,-6],[62,-10],[65,-4],[25,0],[0,-5],[-20,-17]],bone[2]);
  for(let i=0;i<8;i++) {
    const px=11+i*7, upper=-32-(i>4?1:0),len=8+(i%3)*2;
    shape([[px,upper],[px+5,upper],[px+3,upper+len]],bone[3]);
    if(i!==2&&i!==6) shape([[px-1,-8],[px+4,-9],[px+2,-17-(i%2)*3]],bone[2]);
  }
  put(-27,-70,3,15,bone[1]);put(-29,-55,4,2,bone[1]);
  if(form===1) shape([[-39,-75],[-58,-110],[-38,-96],[-27,-80]],bone[2]);
  if(form===2) shape([[-13,-79],[2,-107],[14,-83]],bone[2]);
}
function skeleton(rect,floor,v) {
  const flip=v===2?-1:1, sx=x=>x*flip;
  const baseAt=x=>floor(sx(x))-7;
  const count=v===1?11:v===2?6:8;
  const tailStart=v===2?-135:-172;
  const neck=79;
  const points=Array.from({length:19},(_,i)=>{
    const t=i/18, x=tailStart+(neck-tailStart)*t;
    return [sx(x),baseAt(x)-Math.sin(Math.PI*t)*10];
  });
  // Connected spinal silhouette, irregular articulated vertebrae, and spines.
  ribbon(rect,points,8);
  points.forEach(([px,py],i)=>{
    const size=5+7*Math.sin(Math.PI*(i+2)/23);
    poly(rect,[[px-size,py-4],[px-3,py-size],[px+5,py-size],[px+size,py-1],[px+5,py+6],[px-size+2,py+5]],bone[1]);
    rect(px-3,py-size+1,6,3,bone[3]);
    if(i%3!==0) ribbon(rect,[[px,py-3],[px-4*flip,py-size-8],[px-5*flip,py-size-13]],3);
  });
  for(let i=0;i<count;i++) {
    const u=i/(count-1), start=-130+u*190;
    const foot=baseAt(start), h=(v===1?133:v===2?91:105)*(.55+.45*Math.sin(Math.PI*(u*.86+.1)));
    const width=24+u*22;
    const pts=Array.from({length:25},(_,j)=>{
      const t=j/24,dx=start+Math.sin(t*Math.PI*.91)*width+t*12;
      return [sx(dx),foot-Math.sin(t*Math.PI*.94)*h+t*(baseAt(dx)-foot)];
    });
    // Broken specimens have missing rib tips; the others curve continuously.
    ribbon(rect,i%5===1&&v!==1?pts.slice(0,17):pts,5.1+u*1.6);
  }
  // Rest the jaw on the actual terrain beneath its footprint, with buried
  // portions clipped by the painter. Skull joins the neck via a curved bone.
  const head=118, headFloor=Math.max(...[-28,0,28,55].map(dx=>baseAt(head+dx)))+5;
  ribbon(rect,[[sx(65),baseAt(65)-3],[sx(81),baseAt(81)-15],[sx(91),headFloor-25]],8);
  skull(rect,sx(head),headFloor,v,flip);
  // Grounded fragments and sediment staining.
  for(let i=0;i<7;i++) {
    const px=sx(-170+rand(i,v+8)*330),py=floor(px)-2;
    ribbon(rect,[[px-8,py],[px,py-4],[px+10,py-2]],2.5);
  }
}
function coralBranch(rect,x,y,h,seed,palette) {
  for(let j=0;j<h;j+=3) {
    const sx=x+Math.sin(j*.1+seed)*j*.12;
    rect(sx-3,y-j,7,4,palette[1]);
    rect(sx-2,y-j,3,3,palette[2]);
    if(j>10&&j%15===0) {
      const side=j%30===0?-1:1;
      for(let k=0;k<15;k+=3) {
        rect(sx+side*k-2,y-j-k*.9,5,4,palette[2]);
        if(k===12) rect(sx+side*k-2,y-j-k*.9-2,5,3,palette[3]);
      }
    }
  }
}
function garden(rect,x,y,v,time,isKelp) {
  for(let i=0;i<9;i++) {
    const px=x-94+i*23, h=36+rand(i,v+3)*89;
    const py=y+5+rand(i,v+7)*10;
    rect(px-11,py-5,22,9,stone[0]);
    rect(px-8,py-7,16,4,stone[1]);
    if(isKelp||i%3===0) vine(rect,px,py,h,i+v*3,time);
    else coralBranch(rect,px,py,h,i+v, i%2?reef:['#3d566b','#517e88','#76b1af','#a3d2c5']);
  }
}

// Salt-blackened wreck timber, exposed end grain, rusty fittings and algae.
const wreckWood = ['#283c3b','#473e37','#6a5241','#8e7252','#b49a71'];
function wreckBeam(rect, x1, y1, x2, y2, width, seed) {
  const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
  const shape=(w,offset=0)=>[
    [x1+nx*(-w+offset),y1+ny*(-w+offset)],
    [x2+nx*(-w+offset),y2+ny*(-w+offset)],
    [x2+dx/length*4+nx*offset,y2+dy/length*4+ny*offset],
    [x2+nx*(w+offset),y2+ny*(w+offset)],
    [x1+nx*(w+offset),y1+ny*(w+offset)],
    [x1-dx/length*3,y1-dy/length*3],
  ];
  poly(rect,shape(width/2),wreckWood[0],1);
  poly(rect,shape(Math.max(1,width/2-1)),wreckWood[2],1);
  poly(rect,shape(1,-width*.28),wreckWood[3],1);
  for(let t=7;t<length-4;t+=9) {
    const x=x1+dx*t/length,y=y1+dy*t/length;
    rect(x-1,y-1,2,2,rand(seed,t)>.5?wreckWood[1]:'#89948a');
  }
}
function debris(rect,floor,variant,seed,time) {
  const f=x=>floor(x);
  if(variant==='hull') {
    // Broken, sloping hull with the lower frame buried on the local seabed.
    const base=Math.min(...[-58,-35,-12,10,32,56].map(f))-4;
    const top=base-39;
    const silhouette=[[-66,top-12],[-49,top-4],[-39,top-11],[-26,top+7],[-8,top+3],[5,top+12],[22,top+6],[47,top+22],[64,base-6],[47,base+7],[16,base+14],[-19,base+10],[-48,base-3]];
    poly(rect,silhouette,wreckWood[0]);
    for(let i=0;i<5;i++) {
      const y=top+i*9, start=-57+i*3, end=4+i*11;
      wreckBeam(rect,start,y,end,y+10,7,seed+i);
    }
    for(const x of [-51,-26,0,25,47]) {
      wreckBeam(rect,x,base-24+(x+50)*.16,x+6,f(x+6)+5,7,seed+x);
    }
    wreckBeam(rect,-67,top-9,-45,base-1,6,seed);
    wreckBeam(rect,-45,base-1,5,base+10,7,seed+1);
    wreckBeam(rect,5,base+10,57,base-2,7,seed+2);
    vine(rect,-23,base-3,24,seed,time);
  } else if(variant==='mast') {
    const root=f(24);
    wreckBeam(rect,24,root+3,-43,root-69,10,seed);
    wreckBeam(rect,-51,root-46,-2,root-80,6,seed+1);
    wreckBeam(rect,28,root+2,59,f(59)+2,7,seed+2);
    // Ragged sail still tangled around the broken spar.
    poly(rect,[[-44,root-62],[-6,root-78],[-12,root-50],[-20,root-54],[-24,root-40],[-31,root-46]],'#4b6560');
    poly(rect,[[-38,root-61],[-12,root-73],[-19,root-58],[-24,root-62],[-29,root-49]],'#74857a');
    for(let i=0;i<9;i++) rect(-30+i*3,root-58+i*3,2,2,'#a39170');
  } else if(variant==='cargo') {
    // Split barrel and a broken ship's wheel amongst the planks.
    const bx=-28,by=f(bx)-3;
    poly(rect,[[bx-15,by-27],[bx+12,by-27],[bx+17,by-14],[bx+11,by+4],[bx-13,by+4],[bx-18,by-13]],wreckWood[0]);
    for(let i=0;i<5;i++) rect(bx-13+i*5,by-24,4,27,wreckWood[2+i%2]);
    for(const y of [-21,-5]) {rect(bx-17,by+y,34,3,'#485653');rect(bx-16,by+y,32,1,'#88938a');}
    const cx=27,cy=f(cx)-23;
    for(let i=0;i<7;i++) {
      const a=i*Math.PI*2/8,b=(i+1)*Math.PI*2/8;
      wreckBeam(rect,cx+Math.cos(a)*20,cy+Math.sin(a)*20,cx+Math.cos(b)*20,cy+Math.sin(b)*20,4,seed+i);
      if(i%2===0) wreckBeam(rect,cx,cy,cx+Math.cos(a)*25,cy+Math.sin(a)*25,3,seed+i);
    }
    rect(cx-3,cy-3,6,6,wreckWood[3]);
    wreckBeam(rect,43,f(43)-9,63,f(63)+2,5,seed);
  } else {
    // A ragged cluster of loose planks, with each end resting on its own floor.
    for(let i=0;i<5;i++) {
      const x=-55+i*22+rand(i,seed)*9, end=x+18+rand(i,seed+2)*16;
      wreckBeam(rect,x,f(x)-3-rand(i,seed+3)*14,end,f(end)+2,5+rand(i,seed+1)*4,seed+i);
    }
    wreckBeam(rect,-27,f(-27)-16,14,f(14)+2,5,seed+9);
  }
  // Tiny splinters and barnacles mark the trail without obstructing movement.
  for(let i=0;i<6;i++) {
    const px=-62+rand(i,seed+41)*124,py=f(px)-1;
    rect(px,py-2,3+rand(i,seed+15)*5,3,i%2?wreckWood[3]:'#657b67');
  }
}

export function drawOceanLandmark(rect,item,time) {
  const {x,y,style,variant,scale=1}=item;
  const clipped=terrainPainter(rect,item);
  const local=(px,py,w,h,c)=>clipped(x+px*scale,y+py*scale,w*scale,h*scale,c);
  const floor=px=>(landmarkFloorAt(item,x+px*scale)-y)/scale;
  if(style==='ruin') ruin(local,floor,variant,time);
  else if(style==='bones') skeleton(local,floor,variant);
  else if(style==='wreck-debris') debris(local,floor,variant,item.seed ?? 0,time);
  else {
    // Ground each individual plant; no shared floating baseline.
    for(let i=0;i<9;i++) {
      const px=-94+i*23,py=floor(px),h=36+rand(i,variant+3)*89;
      if(style==='kelp'||i%3===0) vine(local,px,py,h,i+variant*3,time);
      else coralBranch(local,px,py,h,i+variant,i%2?reef:['#3d566b','#517e88','#76b1af','#a3d2c5']);
    }
  }
}
