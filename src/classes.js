import { STARTER_CLASSES } from './starter-classes.js';

// Class progression is independent of the inventory, but the souls that fund it are items.
// Only the currently attuned class is active; each class remembers its own build.
const node = (id, name, detail, effect, major = false) => ({ id, name, detail, effect, major });
const path = (id, name, icon, description, nodes) => ({ id, name, icon, description, nodes });

export const SOUL_ITEMS = Object.freeze({ lesser: 'lesser-soul', greater: 'greater-soul' });
export const CLASS_DEFS = Object.freeze({
  ...STARTER_CLASSES,
  stormborn: {
    id: 'stormborn', name: 'Stormborn', title: 'Heir of the Tempest', symbol: 'ϟ', accent: '#79d9ff',
    description: 'Command the storm through velocity, electric force, and winds that turn aside danger.',
    domain: 'Lightning · Flight · Protection',
    paths: [
      path('tempest', 'Tempest', 'ϟ', 'Channel the storm into every strike.', [
        node('sparkbite', 'Sparkbite', '+1 damage with weapons.', { attack: 1 }),
        node('voltaic-rhythm', 'Voltaic Rhythm', '+2 weapon damage.', { attack: 2 }),
        node('stormheart', 'Stormheart', '+5 weapon damage and +5% ground speed.', { attack: 5, move: .05 }, true),
      ]),
      path('windwalker', 'Windwalker', '✧', 'Turn motion into freedom.', [
        node('tailwind', 'Tailwind', '+10% running speed.', { move: .10 }),
        node('featherfall', 'Featherfall', '35% less fall damage.', { fall: .35 }),
        node('skybreaker', 'Skybreaker', '+25% running speed and 65% less fall damage.', { move: .25, fall: .65 }, true),
      ]),
      path('stormcaller', 'Stormcaller', '◈', 'Wear the storm like a shield.', [
        node('gale-ward', 'Gale Ward', '6% less incoming damage.', { resist: .06 }),
        node('slipstream', 'Slipstream', '12% faster swimming.', { swim: .12 }),
        node('cyclone-mantle', 'Cyclone Mantle', '18% less damage and +10% ground speed.', { resist: .18, move: .10 }, true),
      ]),
    ],
  },
  tideweaver: {
    id: 'tideweaver', name: 'Tideweaver', title: 'Keeper of the Deep', symbol: '≋', accent: '#6cead3',
    description: 'Let the currents heal, carry, and shelter you where ordinary explorers cannot breathe.',
    domain: 'Restoration · Currents · Sanctuary',
    paths: [
      path('restoration', 'Restoration', '✦', 'Mend what the world has broken.', [
        node('springwater', 'Springwater', 'Restore 0.3 health each second.', { regen: .3 }),
        node('mending-current', 'Mending Current', 'Restore another 0.5 health each second.', { regen: .5 }),
        node('tides-embrace', "Tide's Embrace", 'Restore 1.5 more health per second and take 8% less damage.', { regen: 1.5, resist: .08 }, true),
      ]),
      path('currents', 'Currents', '≈', 'Make the ocean your road.', [
        node('streamstep', 'Streamstep', 'Swim 16% faster.', { swim: .16 }),
        node('deep-lung', 'Deep Lung', '+8 seconds of breath.', { oxygen: 8 }),
        node('riptide', 'Riptide', 'Swim another 30% faster and gain 12 more seconds of breath.', { swim: .30, oxygen: 12 }, true),
      ]),
      path('sanctuary', 'Sanctuary', '◉', 'Carry a safe harbor within.', [
        node('pearl-skin', 'Pearl Skin', '6% less incoming damage.', { resist: .06 }),
        node('soothing-foam', 'Soothing Foam', '5% less damage and +0.5 health regenerated per second.', { resist: .05, regen: .5 }),
        node('oceans-shelter', "Ocean's Shelter", '20% less damage and +1 health regenerated per second.', { resist: .20, regen: 1 }, true),
      ]),
    ],
  },
  stonebound: {
    id: 'stonebound', name: 'Stonebound', title: 'Oath of the Mountain', symbol: '◆', accent: '#eac18a',
    description: 'Hold your ground, master the earth, and hear the ore singing deep beneath your feet.',
    domain: 'Fortitude · Mining · Resonance',
    paths: [
      path('bulwark', 'Bulwark', '⬡', 'Stand unbroken against the world.', [
        node('granite-hide', 'Granite Hide', '8% less incoming damage.', { resist: .08 }),
        node('anchored-heart', 'Anchored Heart', '12% less incoming damage.', { resist: .12 }),
        node('living-bastion', 'Living Bastion', '25% less incoming damage.', { resist: .25 }, true),
      ]),
      path('earthshaper', 'Earthshaper', '◇', 'Carve safe paths through solid rock.', [
        node('sure-hands', 'Sure Hands', 'Mine 10% faster.', { mine: .10 }),
        node('soft-landing', 'Soft Landing', '25% less fall damage.', { fall: .25 }),
        node('mountain-hand', 'Mountain Hand', 'Mine 35% faster and take 50% less fall damage.', { mine: .35, fall: .50 }, true),
      ]),
      path('resonance', 'Resonance', '✧', 'Feel hidden minerals through the stone.', [
        node('telltale-ore', 'Telltale Ore', 'Reveal nearby ore up to 8 tiles away.', { ore: 8 }),
        node('deep-pulse', 'Deep Pulse', 'Reveal ore up to 14 tiles away and mine 5% faster.', { ore: 14, mine: .05 }),
        node('heart-of-earth', 'Heart of Earth', 'Reveal ore up to 22 tiles away and mine 20% faster.', { ore: 22, mine: .20 }, true),
      ]),
    ],
  },
});

const emptyBuilds = () => Object.fromEntries(Object.keys(CLASS_DEFS).map((id) => [id, []]));
export function createClassProgress(saved) {
  const total = {};
  for (const type of ['lesser', 'greater']) {
    const n = saved?.total?.[type];
    total[type] = Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 100000) : 0;
  }
  const builds = emptyBuilds();
  for (const [id, def] of Object.entries(CLASS_DEFS)) {
    const wanted = new Set(Array.isArray(saved?.builds?.[id]) ? saved.builds[id].filter((n) => typeof n === 'string') : []);
    const spent = { lesser: 0, greater: 0 };
    for (const branch of def.paths) {
      for (const skill of branch.nodes) {
        if (!wanted.has(skill.id)) break;
        const cost = skillCost(skill);
        if (spent.lesser + cost.lesser > total.lesser || spent.greater + cost.greater > total.greater) break;
        spent.lesser += cost.lesser;
        spent.greater += cost.greater;
        builds[id].push(skill.id);
      }
    }
  }
  const claimed = Array.isArray(saved?.claimed)
    ? [...new Set(saved.claimed.filter((id) => typeof id === 'string' && id.length <= 120))].slice(0, 5000)
    : [];
  return { active: Object.hasOwn(CLASS_DEFS, saved?.active) ? saved.active : null, total, builds, claimed };
}
export function skillCost(skill) { return skill.major ? { lesser: 2, greater: 1 } : { lesser: 1, greater: 0 }; }
export function skillBudget(progress, classId = progress.active) {
  const def = CLASS_DEFS[classId];
  const spent = { lesser: 0, greater: 0 };
  if (def) for (const branch of def.paths) for (const skill of branch.nodes) {
    if (progress.builds[classId]?.includes(skill.id)) {
      const cost = skillCost(skill);
      spent.lesser += cost.lesser;
      spent.greater += cost.greater;
    }
  }
  return { lesser: progress.total.lesser - spent.lesser, greater: progress.total.greater - spent.greater };
}
export function skillBonuses(progress) {
  const buffs = { attack: 0, move: 0, swim: 0, fall: 0, resist: 0, regen: 0, oxygen: 0, mine: 0, ore: 0,
    guard: 0, ward: 0, lowHealthAttack: 0, lifesteal: 0,
    wardenResistance: 0, extraDraw: 0, horizonShot: 0, meleePower: 0, heat: 0, counter: 0, perfectWeapon: 0, catchAlly: 0, huntersMark: 0,
    brace: 0, shieldRush: 0, desperateResist: 0, missingHealthAttack: 0, rage: 0, perfectArmor: 0, guardianCry: 0, aegisAura: 0,
    bowDamage: 0, arrowSpeed: 0, bowCooldown: 0, arrowPierce: 0, snare: 0, rootedDamage: 0,
    healBoost: 0, cleanse: 0, torchDuration: 0, catalystSeconds: 0, catalystMove: 0, catalystAttack: 0,
    poison: 0, poisonDuration: 0 };
  const def = CLASS_DEFS[progress?.active];
  if (!def) return buffs;
  const unlocked = new Set(progress.builds[def.id] || []);
  for (const branch of def.paths) for (const skill of branch.nodes) if (unlocked.has(skill.id)) {
    for (const [key, value] of Object.entries(skill.effect)) {
      buffs[key] = key === 'ore' ? Math.max(buffs[key], value) : buffs[key] + value;
    }
  }
  buffs.resist = Math.min(.8, buffs.resist);
  buffs.fall = Math.min(1, buffs.fall);
  buffs.mine = Math.min(.85, buffs.mine);
  buffs.guard = Math.min(.75, buffs.guard);
  buffs.lifesteal = Math.min(.35, buffs.lifesteal);
  buffs.snare = Math.min(3, buffs.snare);
  buffs.ward = Math.min(50, buffs.ward);
  return buffs;
}
export function activateClass(game, id) {
  if (!Object.hasOwn(CLASS_DEFS, id)) return 'Unknown class.';
  game.classes.active = id;
  game.player.skillBonuses = skillBonuses(game.classes);
  game.player.catalystSeconds = 0;
  game.player.braceTime = game.player.rushTime = game.player.rageTime = game.player.aegisTime = 0;
  game.player.bracing = false;
  game.bowDraw = null;
  game.player.heatHits = [];
  game.player.heatBonus = game.player.counterTime = game.player.markArmed = 0;
  game.player.catching = false;
  game.player.wardShield = game.player.skillBonuses.ward;
  game.player.wardCooldown = 0;
  game.dirty = true;
  return null;
}
export function unlockSkill(game, id) {
  const progress = game.classes;
  const def = CLASS_DEFS[progress.active];
  if (!def) return 'Choose a class first.';
  const branch = def.paths.find((entry) => entry.nodes.some((node) => node.id === id));
  if (!branch) return 'That skill belongs to another class.';
  const index = branch.nodes.findIndex((node) => node.id === id);
  if (progress.builds[def.id].includes(id)) return 'Already unlocked.';
  if (index && !progress.builds[def.id].includes(branch.nodes[index - 1].id)) return 'Unlock the previous star first.';
  const cost = skillCost(branch.nodes[index]);
  const balance = skillBudget(progress);
  if (balance.lesser < cost.lesser || balance.greater < cost.greater) return 'Not enough attuned souls.';
  const previousWard = game.player.skillBonuses?.ward ?? 0;
  progress.builds[def.id].push(id);
  game.player.skillBonuses = skillBonuses(progress);
  game.player.wardShield = Math.min(game.player.skillBonuses.ward,
    (game.player.wardShield || 0) + Math.max(0, game.player.skillBonuses.ward - previousWard));
  game.dirty = true;
  return null;
}
export function absorbSouls(game, type, amount = 1) {
  if (!game.classes.active) return 'Awaken a class before using souls.';
  const id = SOUL_ITEMS[type];
  if (!id) return 'Unknown soul.';
  const owned = game.inventory.count(id);
  if (!owned) return 'You have no souls of this kind.';
  const count = Math.min(owned, Math.max(1, Math.floor(amount)));
  game.inventory.spend(id, count);
  game.classes.total[type] += count;
  game.dirty = true;
  return null;
}
