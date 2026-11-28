import assert from 'node:assert/strict';
import test from 'node:test';
import { createLootCatalog, itemSources } from '../src/loot-catalog.js';
import { rollMobLoot, mobSoulReward } from '../src/loot.js';
import { WILD_CHEST_LOOT_TABLES } from '../src/world/wild-chest.js';
import { generateFixtures } from '../src/world/generation.js';

test('loot documentation follows every wild table and fixed chest', () => {
  const catalog = createLootCatalog();
  for (const table of Object.values(WILD_CHEST_LOOT_TABLES)) {
    assert.equal(catalog.find(s => s.kind === 'Wild chest' && s.area === table.name).entries, table.entries);
  }
  for (const fixture of generateFixtures().filter(f => f.kind === 'chest' && f.chestType !== 'wild')) {
    const source = catalog.find(s => s.kind === 'Chest' && s.name === fixture.name && s.area === fixture.lootArea);
    assert.ok(source, fixture.id);
    for (const stack of [fixture.loot, ...(fixture.bonusLoot ?? [])]) {
      assert.ok(source.entries.some(e => e.id === stack.id && e.min === stack.count && e.chance === 1));
    }
  }
});
test('existing mob loot rates and quantities remain unchanged', () => {
  assert.deepEqual(rollMobLoot({ kind: 'ghost', resident: true }), { id: 'parrot-pet', count: 1 });
  assert.deepEqual(rollMobLoot({ kind: 'ghost' }, () => .049), { id: 'captains-cutlass', count: 1 });
  assert.equal(rollMobLoot({ kind: 'ghost' }, () => .05), null);
  assert.deepEqual(rollMobLoot({ kind: 'armored-skeleton' }, () => .099), { id: 'morningstar', count: 1 });
  assert.equal(rollMobLoot({ kind: 'armored-skeleton' }, () => .1), null);
  assert.deepEqual(rollMobLoot({ kind: 'lionfish' }), { id: 'poison-needle', count: 2 });
  assert.equal(mobSoulReward({ kind: 'kraken' }), 'greater');
  assert.equal(mobSoulReward({ kind: 'mimic' }), 'lesser');
  assert.equal(mobSoulReward({ kind: 'mimic', krakenMinion: true }), null);
});
test('item origins aggregate chest, creature, crafting and gathering sources', () => {
  const sources = itemSources();
  assert.ok(sources['captains-cutlass'].some(s => s.includes('Crew ghost')));
  assert.ok(sources['captains-cutlass'].some(s => s.includes('chest')));
  assert.ok(sources['parrot-pet'].some(s => s.includes("Captain's ghost")));
  assert.ok(sources.iron.some(s => s.includes('Sunken ruins')));
  assert.ok(sources.iron.some(s => s.includes('Mining')));
  assert.ok(sources.iron.some(s => s.includes('Crafting')));
  assert.equal(sources.pearl, undefined);
});
