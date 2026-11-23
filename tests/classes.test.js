
import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory.js';
import { createGame, stepGame } from '../src/gameplay/simulation.js';
import { damageMob } from '../src/gameplay/mobs.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { absorbSouls, activateClass, CLASS_DEFS, createClassProgress, skillBonuses, skillBudget, unlockSkill } from '../src/classes.js';

function game() {
  return { inventory: new Inventory(), classes: createClassProgress(), player: { skillBonuses: {} }, dirty: false };
}
test('all three classes contain three paths and boss-gated major stars', () => {
  assert.equal(Object.keys(CLASS_DEFS).length, 3);
  for (const def of Object.values(CLASS_DEFS)) {
    assert.equal(def.paths.length, 3);
    for (const path of def.paths) {
      assert.equal(path.nodes.length, 3);
      assert.equal(path.nodes.filter((node) => node.major).length, 1);
      assert.equal(path.nodes[2].major, true);
    }
  }
});
test('souls cannot be used without a class; attunement consumes physical items', () => {
  const state = game();
  state.inventory.add('lesser-soul', 5);
  state.inventory.add('greater-soul', 1);
  assert.match(absorbSouls(state, 'lesser'), /class/i);
  assert.equal(state.inventory.count('lesser-soul'), 5);
  assert.equal(activateClass(state, 'stormborn'), null);
  assert.equal(absorbSouls(state, 'lesser', 5), null);
  assert.equal(absorbSouls(state, 'greater'), null);
  assert.equal(state.inventory.count('lesser-soul'), 0);
  assert.deepEqual(state.classes.total, { lesser: 5, greater: 1 });
});
test('progression requires previous lesser stars and both soul types for milestones', () => {
  const state = game();
  activateClass(state, 'stormborn');
  state.inventory.add('lesser-soul', 4);
  absorbSouls(state, 'lesser', 4);
  assert.match(unlockSkill(state, 'stormheart'), /previous/i);
  assert.equal(unlockSkill(state, 'sparkbite'), null);
  assert.equal(unlockSkill(state, 'voltaic-rhythm'), null);
  assert.match(unlockSkill(state, 'stormheart'), /souls/i);
  state.inventory.add('greater-soul', 1);
  absorbSouls(state, 'greater');
  assert.equal(unlockSkill(state, 'stormheart'), null);
  assert.deepEqual(skillBudget(state.classes), { lesser: 0, greater: 0 });
  assert.equal(skillBonuses(state.classes).attack, 8);
  assert.match(unlockSkill(state, 'stormheart'), /already/i);
});
test('class swapping remembers individual builds without duplicating total soul budget', () => {
  const state = game();
  activateClass(state, 'stonebound');
  state.inventory.add('lesser-soul', 2);
  absorbSouls(state, 'lesser', 2);
  unlockSkill(state, 'granite-hide');
  assert.equal(skillBonuses(state.classes).resist, .08);
  activateClass(state, 'tideweaver');
  assert.equal(skillBudget(state.classes).lesser, 2);
  assert.equal(skillBonuses(state.classes).resist, 0);
  unlockSkill(state, 'springwater');
  assert.equal(skillBonuses(state.classes).regen, .3);
  activateClass(state, 'stonebound');
  assert.equal(skillBonuses(state.classes).resist, .08);
  assert.equal(skillBudget(state.classes).lesser, 1);
});
test('saved builds validate node ids, prerequisites and their soul budget', () => {
  const progress = createClassProgress({ active: 'stonebound', total: { lesser: 1, greater: 1 },
    builds: { stonebound: ['granite-hide', 'anchored-heart', 'living-bastion', 'nonsense'] } });
  assert.deepEqual(progress.builds.stonebound, ['granite-hide']);
  assert.equal(skillBudget(progress).lesser, 0);
});

test('boss souls survive a full backpack and remain one-time rewards after saving', () => {
  const state = createGame();
  const boss = state.world.mobs.find((mob) => mob.kind === 'kraken');
  assert.ok(boss);
  for (const group of ['hotbar', 'backpack']) {
    state.inventory[group] = state.inventory[group].map(() => ({ id: 'wood', count: 1 }));
  }
  damageMob(state.world, boss, boss.maxHealth, 0, 0, state.effects);
  stepGame(state, {}, 1 / 60);
  assert.equal(state.inventory.count('greater-soul'), 0);
  assert.equal(state.world.soulRewards.length, 1);
  const restored = createGame(decodeSave(encodeSave(state)));
  assert.equal(restored.world.soulRewards.length, 1);
  restored.inventory.backpack[0] = null;
  stepGame(restored, {}, 1 / 60);
  assert.equal(restored.inventory.count('greater-soul'), 1);
  assert.equal(restored.world.soulRewards.length, 0);
  assert.ok(restored.classes.claimed.includes(boss.id));
  const savedAgain = createGame(decodeSave(encodeSave(restored)));
  assert.equal(savedAgain.inventory.count('greater-soul'), 1);
  assert.ok(savedAgain.classes.claimed.includes(boss.id));
});
