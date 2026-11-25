// Equally viable starter callings. Their availability differs from the
// discoverable callings only in the future world-statue placement.
const star = (id, name, detail, effect, major = false) => ({ id, name, detail, effect, major });
const branch = (id, name, icon, description, nodes) => ({ id, name, icon, description, nodes });

export const STARTER_CLASS_IDS = Object.freeze(['warden', 'wayfarer', 'scholar']);
export const STARTER_CLASSES = Object.freeze({
  warden: {
    id: 'warden', name: 'Warden', title: 'Oath of the Vigil', symbol: '⬡', accent: '#e8ae88',
    description: 'A watchful defender, relentless brawler, and steadfast protector of fragile lives.',
    domain: 'Guard · Resolve · Protection',
    paths: [
      branch('defender', 'Defender', '⬡', 'Hold the line when danger closes in.', [
        star("shield-discipline", "Shield Discipline", "Take 10% less incoming damage.", {"resist":0.1,"wardenResistance":1}),
        star("ironwall", "Ironwall", "Hold S on land instead of crouching. After 1.5s, take 50% less damage until released. Cannot attack while bracing.", {"brace":1}),
        star("unyielding", "Shield Rush", "Q: With a shield equipped, rush forward invulnerably and knock enemies back. 18s cooldown.", {"shieldRush":1}, true),
      ]),
      branch('berserker', 'Berserker', '⚔', 'Make desperation your greatest strength.', [
        star("battle-temper", "Battle Temper", "Below 50% health, take 20% less damage.", {"desperateResist":0.2}),
        star("bloodrush", "Bloodrush", "Deal up to 100% extra weapon damage as health falls. Your health bar changes color.", {"missingHealthAttack":1}),
        star("reavers-oath", "Rage", "R: For 8s, recover 30% of weapon damage dealt as health. 25s cooldown.", {"rage":1}, true),
      ]),
      branch('protector', 'Protector', '◈', 'Forge exceptional armor and protect nearby allies.', [
        star("watchers-ward", "Perfect Forge", "Crafted breastplates have a 10% chance to become Perfect Armor (+5 percentage points of protection).", {"perfectArmor":0.1}),
        star("sanctuary-guard", "Guardian Cry", "When a nearby ally is injured, cry out and draw nearby enemies toward you. 20s cooldown.", {"guardianCry":1}),
        star("aegis-oath", "Aegis Aura", "T: Project a shield in your facing direction for 8s. Nearby allies behind it take 30% less damage. 25s cooldown.", {"aegisAura":1}, true),
      ]),
    ],
  },
  wayfarer: {
    id: 'wayfarer', name: 'Wayfarer', title: 'The Far Horizon', symbol: '➶', accent: '#b4dda1',
    description: 'A wanderer who reads the terrain, commands distance, and turns every trail into an advantage.',
    domain: 'Precision · Snares · Exploration',
    paths: [
      branch('marksman', 'Marksman', '➶', 'Turn every arrow into a deliberate strike.', [
        star('sharpened-eye', 'Sharpened Eye', '+2 damage with bows.', { bowDamage: 2 }),
        star('quickdraw', 'Quickdraw', 'Arrows fly 25% faster and bows reload 15% faster.', { arrowSpeed: .25, bowCooldown: .15 }),
        star('splitting-arrow', 'Splitting Arrow', 'Arrows pierce one additional enemy and deal 4 more bow damage.', { arrowPierce: 1, bowDamage: 4 }, true),
      ]),
      branch('trapper', 'Trapper', '⟐', 'Pin down your prey before it can respond.', [
        star('snareshot', 'Snareshot', 'Arrows briefly root ordinary enemies for 0.4 seconds.', { snare: .4 }),
        star('barbed-trail', 'Barbed Trail', 'Add 0.8 seconds of root and 1 bow damage.', { snare: .8, bowDamage: 1 }),
        star('master-snare', 'Master Snare', 'Add 1.5 seconds of root; arrows deal 4 more damage to already rooted enemies.', { snare: 1.5, rootedDamage: 4 }, true),
      ]),
      branch('pathfinder', 'Pathfinder', '✧', 'Know the ground before it knows you.', [
        star('trailrunner', 'Trailrunner', 'Move 8% faster on land.', { move: .08 }),
        star('safe-footing', 'Safe Footing', 'Reduce fall damage by 35%.', { fall: .35 }),
        star('far-sight', 'Far Sight', 'Move 12% faster, reveal ore within 14 tiles, and take another 15% less fall damage.', { move: .12, ore: 14, fall: .15 }, true),
      ]),
    ],
  },
  scholar: {
    id: 'scholar', name: 'Scholar', title: 'Keeper of Hidden Lore', symbol: '✥', accent: '#ceaff2',
    description: 'A learned explorer who turns remedies, experiments, and unusual ingredients into power.',
    domain: 'Healing · Concoctions · Poison',
    paths: [
      branch('remedies', 'Remedies', '✚', 'Know how to mend body and spirit.', [
        star('field-dressing', 'Field Dressing', 'Kelp dressings heal 30% more.', { healBoost: .30 }),
        star('naturalists-care', "Naturalist's Care", 'Regenerate 0.45 health per second.', { regen: .45 }),
        star('purifying-tonic', 'Purifying Tonic', 'Dressings heal another 25%, cleanse bleeding, poison, shock and confusion, and regenerate 0.6 more health per second.', { healBoost: .25, regen: .6, cleanse: 1 }, true),
      ]),
      branch('catalysis', 'Catalysis', '⚗', 'Extract more from every ingredient.', [
        star('luminous-formula', 'Luminous Formula', 'Glowshroom torches last 50% longer; mine 6% faster.', { torchDuration: .5, mine: .06 }),
        star('invigorating-elixir', 'Invigorating Elixir', 'Using a dressing also grants 16 seconds of +12% movement speed and +1 damage.', { catalystSeconds: 16, catalystMove: .12, catalystAttack: 1 }),
        star('perfected-catalyst', 'Perfected Catalyst', 'Add 20 seconds, +13% movement and +2 damage to the elixir, and double torch duration.', { catalystSeconds: 20, catalystMove: .13, catalystAttack: 2, torchDuration: .5 }, true),
      ]),
      branch('toxicology', 'Toxicology', '☿', 'Study the slow strength of venom.', [
        star('bitter-extract', 'Bitter Extract', 'Weapon hits poison enemies for 3 seconds, dealing 1 damage per second.', { poison: 1 }),
        star('debilitating-compound', 'Debilitating Compound', 'Weapon poison deals another 1 damage each second.', { poison: 1 }),
        star('venom-mist', 'Venom Mist', 'Weapon poison deals another 3 damage per second and lasts 2 more seconds.', { poison: 3, poisonDuration: 2 }, true),
      ]),
    ],
  },
});
