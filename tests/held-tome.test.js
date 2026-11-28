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
      const cover=pixels.find(p=>p.color===spell.cover && p.w===4 && p.h===1 && pixels.some(q=>q.color==='#80664f' && q.x===p.x && q.y===p.y-1));
      assert.ok(cover,id+' '+mode);
      const x=cover.x-1, y=cover.y-1;
      assert.ok(pixels.some(p=>p.color==='#e9d5ac' && p.x===x+1 && p.y===y-7 && p.w===4));
      assert.ok(pixels.some(p=>p.color==='#fff0cf' && p.x===x+7 && p.y===y-7 && p.w===3));
      assert.ok(pixels.some(p=>p.color==='#80664f' && p.x===x+5 && p.y===y-8));
      assert.ok(pixels.some(p=>p.color==='#80664f' && p.x===x+1 && p.y===y));
      assert.ok(pixels.some(p=>p.color===spell.color && p.x===x+5 && p.y===y+1));
      pixels.length=0;
      draw(player,player.appearance,{held:id+'-scroll',swimming:mode==='swim',time:1});
      assert.ok(!pixels.some(p=>p.color==='#fff0cf' && p.w===3));
    }
  }
});
