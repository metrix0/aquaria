// The glyphs are physically chiseled into ruins and rotating stone seals.
const GLYPHS=[[],['00100','01010','10001','01010','00100'],['00000','11000','00111','11000','00111'],['10001','10001','10101','01110','00100'],['01110','10001','10101','10001','01110']];
const S={dark:'#263c43',side:'#405858',face:'#697e73',light:'#8e9c87',edge:'#adb59b',crack:'#34494a',moss:'#456858',algae:'#6a896b'};
const rand=(n,s=0)=>{const v=Math.sin(n*71.31+s*37.19)*43758.5453;return v-Math.floor(v);};
function shape(rect,x,y,points,color){
  const lo=Math.floor(Math.min(...points.map(p=>p[1]))),hi=Math.ceil(Math.max(...points.map(p=>p[1])));
  for(let row=lo;row<hi;row++){
    const cuts=[];
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [ax,ay]=points[j],[bx,by]=points[i],py=row+.5;
      if((ay<=py&&by>py)||(by<=py&&ay>py))cuts.push(ax+(py-ay)*(bx-ax)/(by-ay));
    }
    cuts.sort((a,b)=>a-b);
    for(let i=0;i+1<cuts.length;i+=2){
      const l=Math.floor(cuts[i]),r=Math.ceil(cuts[i+1]);
      if(r>l)rect(x+l,y+row,r-l,1,color);
    }
  }
}
function line(rect,x,y,points,color,width=1){
  for(let i=1;i<points.length;i++){
    const [ax,ay]=points[i-1],[bx,by]=points[i],n=Math.max(Math.abs(bx-ax),Math.abs(by-ay),1);
    for(let j=0;j<=n;j++)rect(x+Math.round(ax+(bx-ax)*j/n),y+Math.round(ay+(by-ay)*j/n),width,width,color);
  }
}
function block(rect,x,y,w,h,seed=0){
  if(w<1||h<1)return;
  if(w<6||h<5){rect(x,y,w,h,S.dark);return;}
  const chip=2+Math.floor(rand(seed)*2);
  shape(rect,x,y,[[0,2],[chip,0],[w-3,0],[w,3],[w-1,h-2],[w-4,h],[2,h],[0,h-3]],S.dark);
  shape(rect,x+1,y+1,[[0,2],[chip,0],[w-5,0],[w-3,2],[w-5,h-3],[1,h-3]],rand(seed,1)>.55?S.face:S.side);
  rect(x+chip,y+1,Math.max(1,w-chip-5),1,S.light);
  if(h>=10&&w>=13&&rand(seed,2)>.4)line(rect,x+5+Math.floor(rand(seed,3)*(w-12)),y+1,[[0,0],[2,3],[0,5],[3,8]],S.crack);
  if(rand(seed,4)>.45)rect(x+3,y+2,Math.max(1,Math.min(w-6,3+Math.floor(rand(seed,5)*7))),2,S.moss);
}
function column(rect,x,base,h,seed,broken){
  block(rect,x-15,base-8,30,8,seed);
  block(rect,x-12,base-15,24,7,seed+1);
  for(let rise=15;rise<h;rise+=11){
    const lean=Math.round((rand(seed,8)-.5)*rise*.045);
    block(rect,x-9+lean,base-rise-11,18,11,seed+rise);
    rect(x-5+lean,base-rise-9,2,7,S.light);
    rect(x+3+lean,base-rise-9,2,7,S.dark);
  }
  if(broken)shape(rect,x,base-h-7,[[-10,6],[-9,-3],[-4,0],[0,-5],[6,0],[9,-2],[10,7]],S.face);
  else {block(rect,x-13,base-h-7,26,7,seed+2);block(rect,x-16,base-h-13,32,6,seed+3);}
}
function carve(rect,x,y,mark,scale,solved=false){
  (GLYPHS[mark]??[]).forEach((row,dy)=>{
    for(let dx=0;dx<row.length;dx++)if(row[dx]==='1'){
      const px=x+Math.round((dx-2.5)*scale),py=y+Math.round((dy-2.5)*scale);
      rect(px,py+1,scale,scale,solved?'#b4d2b3':S.edge);
      rect(px,py,scale,Math.max(1,scale-1),solved?'#d1e5bb':S.dark);
    }
  });
}
function growth(rect,x,y,seed,h){
  for(let i=0;i<h;i+=3){
    const dx=Math.round(Math.sin(i*.23+seed)*Math.min(5,i*.23));
    rect(x+dx,y-i,3,4,S.moss);
    if(i%6===0)rect(x+dx+(i%12===0?-5:2),y-i,6,2,S.algae);
  }
}
export function drawCoralRuin(rect,{x,y,floorY,leftFloorY=floorY,rightFloorY=floorY,mark,variant=0}){
  const base=Math.min(floorY,leftFloorY,rightFloorY),seed=variant*51+Math.round(x);
  for(let i=-4;i<=4;i++){
    const bottom=i<0?leftFloorY:i>0?rightFloorY:floorY;
    for(let by=base-7;by<bottom;by+=8)block(rect,x+i*18-9,by,18,Math.min(8,bottom-by),seed+i+by);
  }
  for(let i=-3;i<=3;i++)block(rect,x+i*18-9,base-14,18,7,seed+20+i);
  column(rect,x-59,base-14,variant===1?43:82,seed+11,variant===1);
  column(rect,x+58,base-14,variant===2?35:74,seed+23,variant===2);
  if(variant===0){
    for(let i=0;i<=12;i++){
      const t=i*Math.PI/12,px=x+Math.round(Math.cos(t)*46),py=base-75-Math.round(Math.sin(t)*27);
      block(rect,px-8,py-7,16,12,seed+i*3);
    }
    block(rect,x-13,base-110,26,9,seed+102);
  }else{
    const side=variant===1?1:-1;
    for(let i=0;i<3;i++)block(rect,x+side*(48-i*15)-8,base-92+i*4,19,11,seed+60+i);
  }
  // The central fractured pier is the clue, without a tablet or display.
  const gy=Math.min(y,base-32),top=Math.min(base-(variant===2?66:73),gy-24),h=base-top;
  shape(rect,x,top,[[-17,9],[-15,2],[-9,0],[-4,4],[4,-3],[12,2],[17,10],[15,h-12],[-18,h-10]],S.dark);
  shape(rect,x,top,[[-14,8],[-12,3],[-7,2],[-3,6],[4,0],[10,4],[13,10],[12,h-14],[-15,h-13]],S.face);
  rect(x-12,top+12,2,Math.max(1,h-30),S.light);
  line(rect,x,top,[[9,8],[5,15],[8,20],[5,24]],S.crack);
  line(rect,x,gy,[[12,5],[7,10],[10,15],[5,22]],S.crack);
  if(mark)carve(rect,x,gy,mark,4);
  block(rect,x-23,base-14,46,7,seed+90);
  for(let i=0;i<9;i++){
    const dx=Math.round((rand(i,seed)-.5)*144),w=6+Math.floor(rand(i,seed+2)*12),h=5+Math.floor(rand(i,seed+3)*6);
    block(rect,x+dx,base-h,w,h,seed+i*11);
  }
  growth(rect,x-66,base-7,seed,24);growth(rect,x+53,base-8,seed+3,31);growth(rect,x-16,base-12,seed+6,16);
}
function altar(rect,x,y,floorY){
  const base=Math.min(floorY,y+44);
  shape(rect,x,y,[[-22,15],[-26,3],[-20,-13],[-13,-22],[3,-19],[13,-23],[42,-21],[53,-25],[72,-21],[95,-22],[112,-17],[121,-8],[120,15],[115,24],[-18,24]],S.dark);
  shape(rect,x,y,[[-19,13],[-22,2],[-16,-12],[-10,-18],[4,-15],[15,-19],[42,-17],[53,-21],[72,-17],[95,-18],[110,-14],[117,-7],[116,13],[111,20],[-15,20]],S.face);
  line(rect,x,y,[[-16,-12],[-10,-18],[4,-15],[15,-19],[42,-17],[53,-21],[72,-17],[95,-18],[110,-14]],S.light,2);
  for(let i=0;i<5;i++){
    const bx=x-20+i*28;
    block(rect,bx,y+23,28,8,200+i);
    if(base>y+31)block(rect,bx+3,y+31,22,base-y-31,300+i);
  }
  line(rect,x,y,[[17,-17],[20,-12],[17,-8],[21,-4]],S.crack);
  line(rect,x,y,[[77,12],[72,16],[75,21]],S.crack);
  growth(rect,x-19,y+23,2,19);growth(rect,x+113,y+20,7,15);
}
export function drawCoralDial(rect,{x,y,floorY,slot},mark,solved){
  if(slot===0)altar(rect,x,y,floorY);
  shape(rect,x,y,[[-8,-14],[7,-14],[13,-8],[14,6],[8,13],[-7,13],[-13,7],[-14,-7]],S.dark);
  shape(rect,x,y,[[-7,-11],[6,-11],[10,-6],[11,5],[6,10],[-6,10],[-10,5],[-11,-6]],S.light);
  line(rect,x,y,[[-8,-12],[7,-12],[11,-8]],S.edge);
  line(rect,x,y,[[-12,6],[-7,11],[7,11],[12,6]],S.side);
  carve(rect,x,y,mark,3,solved);
  for(let i=0;i<=slot;i++)rect(x-slot*2+i*4-1,y+17,2,3,S.dark);
}
