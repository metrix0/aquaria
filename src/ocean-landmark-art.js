// Large, layered pixel-art landmarks. Decorative only: the player can swim
// between ribs, through archways and beneath the kelp canopy.
const stone = ['#203844','#36555b','#567775','#77948a'];
const bone = ['#394c4b','#697d73','#a9b9a1','#d5d6b4'];
const reef = ['#513b59','#996b82','#bd8a91','#dfa9a0'];
const kelp = ['#244d4d','#386e60','#57927a','#81ad88'];
const rand = (n,s=0) => { const v = Math.sin(n*79.17+s*23.49)*43758.5453; return v-Math.floor(v); };

function masonry(rect,x,y,w,h,seed) {
  rect(x,y,w,h,stone[0]);
  rect(x+2,y+1,w-4,h-3,stone[1]);
  rect(x+2,y+1,w-4,2,stone[2]);
  rect(x+w-3,y+3,2,h-5,stone[0]);
  if(rand(seed)>.5) {
    rect(x+w*.36,y+3,2,Math.max(2,h-6),stone[0]);
    rect(x+w*.36-4,y+h-4,6,2,stone[0]);
  }
  if(rand(seed,1)>.5) rect(x+3,y+2,Math.min(w-5,4+rand(seed,2)*9),3,kelp[2]);
}
function pillar(rect,x,y,h,seed) {
  masonry(rect,x-14,y-7,28,12,seed);
  masonry(rect,x-11,y-15,22,8,seed+1);
  for(let rise=15;rise<h;rise+=12) {
    const lean=Math.round((rand(seed,3)-.5)*rise*.065);
    masonry(rect,x-8+lean,y-rise-12,16,12,seed+rise);
    rect(x-3+lean,y-rise-10,2,8,stone[2]);
  }
  masonry(rect,x-15,y-h-13,30,9,seed+2);
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
function ruin(rect,x,y,v,time) {
  // Broken colonnade, submerged gate, and carved lintels. The middle is open.
  for(let i=-6;i<=6;i++) masonry(rect,x+i*18-9,y-7+Math.abs(i%2)*2,18,12,i+v*11);
  for(let i=-5;i<=5;i++) masonry(rect,x+i*18-9,y-14,18,7,i+22);
  const left=84+v*20,right=v===1?58:110-v*9;
  pillar(rect,x-84,y-14,left,7+v); pillar(rect,x-45,y-14,122,19+v);
  pillar(rect,x+45,y-14,122,42+v); pillar(rect,x+84,y-14,right,53+v);
  for(let i=0;i<7;i++) masonry(rect,x-63+i*18,y-153,18,12,90+i+v);
  for(let i=0;i<5;i++) masonry(rect,x-45+i*18,y-161,18,8,110+i);
  // Stepped, broken pediment and engraved band.
  for(let i=0;i<9;i++) {
    const px=x-63+i*14, top=y-164-Math.round((4-Math.abs(i-4))*3);
    if(v!==2||i<6) masonry(rect,px,top,14,9,i+140);
  }
  for(let i=-4;i<=4;i++) if(i%2===0) {
    rect(x+i*12-2,y-149,4,4,'#9eb9a6');
    rect(x+i*12-1,y-148,2,2,stone[0]);
  }
  for(let i=0;i<11;i++) {
    const px=x+(rand(i,17+v)-.5)*224;
    masonry(rect,px,y-3-rand(i,8)*9,8+rand(i,3)*14,6+rand(i,4)*9,i+160);
  }
  for(const [dx,h] of [[-52,53],[-89,30],[49,65],[85,28]]) vine(rect,x+dx,y-142+(Math.abs(dx)>60?46:0),h,dx+v,time,true);
}
function boneSegment(rect,x,y,w,h) {
  rect(x-w/2,y-h/2,w,h,bone[0]);
  rect(x-w/2+2,y-h/2+1,w-4,h-3,bone[1]);
  rect(x-w/2+3,y-h/2+1,w-6,Math.max(2,h*.35),bone[2]);
}
function skeleton(rect,x,y,v) {
  // Leviathan spine, arcing ribs and enormous jaw with broken teeth.
  const flip=v===1?-1:1;
  const sx=dx=>x+dx*flip;
  for(let i=0;i<13;i++) {
    const dx=-147+i*19,dy=-17-Math.sin(i/12*Math.PI)*22;
    boneSegment(rect,sx(dx),y+dy,20,13);
    rect(sx(dx)-3,y+dy-13,6,9,bone[1]);
  }
  for(let i=0;i<7;i++) {
    const base=-98+i*23, h=77+Math.sin(i/6*Math.PI)*35;
    for(let j=0;j<=24;j++) {
      const t=j/24, dx=base+Math.sin(t*Math.PI)*23+t*9;
      const py=y-23-Math.sin(t*Math.PI)*h;
      boneSegment(rect,sx(dx),py,8,10);
    }
  }
  // Skull, dark eye socket, split lower jaw and teeth.
  const bx=sx(119)-32, by=y-78;
  rect(bx+2,by+10,67,40,bone[0]); rect(bx+9,by+4,50,49,bone[1]);
  rect(bx+14,by,37,17,bone[2]); rect(bx+7,by+15,51,29,bone[2]);
  rect(bx+17,by+16,17,17,bone[0]); rect(bx+20,by+19,11,11,'#203c43');
  rect(bx+47,by+25,11,9,bone[0]);
  rect(bx+10,by+48,61,7,bone[1]); rect(bx+14,by+63,53,7,bone[2]);
  rect(bx+15,by+55,7,11,bone[1]);
  for(let i=0;i<6;i++) {rect(bx+23+i*7,by+53,4,8-i%3,bone[2]);rect(bx+23+i*7,by+62,3,4,bone[1]);}
  rect(bx+13,by+7,22,3,bone[3]);
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
export function drawOceanLandmark(rect,{x,y,style,variant},time) {
  if(style==='ruin') ruin(rect,x,y,variant,time);
  else if(style==='bones') skeleton(rect,x,y,variant);
  else garden(rect,x,y,variant,time,style==='kelp');
}
