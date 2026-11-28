import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterRenderer } from '../src/character.js';
import { createGame } from '../src/gameplay/simulation.js';
import { CRAWL_HEIGHT } from '../src/gameplay/player.js';
import { SPELLS } from '../src/spells.js';

test('each held tome draws an angled open book supported by the animated hand', () => {
  const { player } = createGame();
  const pixels = [];
  const ctx = { save(){}, restore(){}, translate(){}, scale(){}, rotate(){},
    fillRect(x,y,w,h){pixels.push({x,y,w,h,color:this.fillStyle});} };
  const draw = createCharacterRenderer(ctx);
  for (const [id, spell] of Object.entries(SPELLS)) {
    for (const mode of ['stand','walk','crawl','swim','climb']) {
      Object.assign(player,{grounded:true, dx:mode==='walk'?80:0, height:mode==='crawl'?CRAWL_HEIGHT:23, climb:mode==='climb'?{kind:'rope',tx:Math.floor(player.x/16)}:null});
      pixels.length=0;
      draw(player,player.appearance,{held:id+'-tome',swimming:mode==='swim',time:1});
      const cover=pixels.filter(p=>p.color===spell.cover && p.w===3 && p.h===1).sort((a,b)=>b.y-a.y)[0];
      assert.ok(cover,id+' '+mode);
      assert.ok(pixels.some(p=>p.color==='#f5e4bb' && p.x===cover.x+2 && p.y===cover.y-8 && p.w===3));
      assert.ok(pixels.some(p=>p.color==='#f5e4bb' && p.x===cover.x+6 && p.y===cover.y-7 && p.w===2));
      assert.ok(pixels.some(p=>p.color==='#80664f' && p.x===cover.x+5 && p.y===cover.y-9 && p.h===1));
      assert.ok(pixels.some(p=>p.color==='#80664f' && p.x===cover.x-2 && p.y===cover.y-2 && p.h===1));
      pixels.length=0;
      draw(player,player.appearance,{held:id+'-scroll',swimming:mode==='swim',time:1});
      assert.ok(!pixels.some(p=>p.color===spell.cover && p.w===3 && p.h===1));
    }
  }
});
