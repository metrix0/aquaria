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
        star("unyielding", "Shield Rush", "With a shield equipped, rush forward invulnerably and knock enemies back. 18s cooldown.", {"shieldRush":1}, true),
      ]),
      branch('berserker', 'Berserker', '⚔', 'Make desperation your greatest strength.', [
        star("battle-temper", "Battle Temper", "Below 50% health, take 20% less damage.", {"desperateResist":0.2}),
        star("bloodrush", "Bloodrush", "Deal up to 100% extra weapon damage as health falls. Your health bar changes color.", {"missingHealthAttack":1}),
        star("reavers-oath", "Rage", "For 8s, recover 30% of weapon damage dealt as health. 25s cooldown.", {"rage":1}, true),
      ]),
      branch('protector', 'Protector', '◈', 'Forge exceptional armor and protect nearby allies.', [
        star("watchers-ward", "Perfect Forge", "Crafted breastplates have a 10% chance to become Perfect Armor (+5 percentage points of protection).", {"perfectArmor":0.1}),
        star("sanctuary-guard", "Guardian Cry", "When a nearby ally is injured, cry out and draw nearby enemies toward you. 20s cooldown.", {"guardianCry":1}),
        star("aegis-oath", "Aegis Aura", "Project a shield in your facing direction for 8s. Nearby allies behind it take 30% less damage. 25s cooldown.", {"aegisAura":1}, true),
      ]),
    ],
  },
  wayfarer: {
    id: 'wayfarer', name: 'Wayfarer', title: 'The Far Horizon', symbol: '➶', accent: '#b4dda1',
    description: 'A wanderer who reads the terrain, commands distance, and turns every trail into an advantage.',
    domain: 'Precision · Martial arts · Exploration',
    paths: [
      branch('marksman', 'Marksman', '➶', 'Turn every arrow into a deliberate strike.', [
        star("sharpened-eye", "Quickdraw", "Arrows fly 25% faster and bows reload 15% faster.", {"arrowSpeed":0.25,"bowCooldown":0.15}),
        star("quickdraw", "Overdraw", "Hold a fully drawn arrow for one extra second: 25% more speed and pierce one enemy.", {"extraDraw":1}),
        star("splitting-arrow", "Horizon Shot", "Fire an instant wide shot to the screen edge. Damage increases with distance. Requires a bow. 20s cooldown.", {"horizonShot":1}, true),
      ]),
      branch('trapper', 'Martial Adept', '⟐', 'Master melee weapons, build heat, and counter incoming attacks.', [
        star("snareshot", "Weapon Mastery", "Melee weapons deal 10% more damage.", {"meleePower":0.1}),
        star("barbed-trail", "Heat", "Melee damage dealt within 5s grants up to 30% extra melee damage.", {"heat":1}),
        star("master-snare", "Counterstance", "Enter a counter stance for 3s. Taking damage triggers a powerful melee strike. 20s cooldown.", {"counter":1}, true),
      ]),
      branch('pathfinder', 'Pathfinder', '✧', 'Know the ground before it knows you.', [
        star("trailrunner", "Perfect Forge", "Crafted weapons have a 10% chance to deal 15% more damage.", {"perfectWeapon":0.1}),
        star("safe-footing", "Safe Landing", "Take 85% less fall damage. Hold S on the ground to catch nearby falling allies, reducing their fall damage by 70%.", {"fall":0.85,"catchAlly":1}),
        star("far-sight", "Hunter Mark", "Mark the next enemy you damage for 12s. It takes 10% more damage from all sources. 25s cooldown.", {"huntersMark":1}, true),
      ]),
    ],
  },
  scholar: {
    id: 'scholar', name: 'Scholar', title: 'Keeper of Hidden Lore', symbol: '\u2725', accent: '#ceaff2',
    description: 'Master magic, experimental alchemy and the art of cooking.',
    domain: 'Tomes ? Alchemy ? Cuisine',
    paths: [
      branch('catalyst', 'Catalyst', '?', 'Channel arcane energy.', [
        star('luminous-formula', 'Tome Mastery', 'Tomes are 7% more effective.', { tomePower: .07 }),
        star('invigorating-elixir', 'Mana', 'Gain 30 mana, regenerating 0.1 per second. Tome casts spend mana equal to their cooldown instead of triggering it when affordable.', { manaCapacity: 30 }),
        star('perfected-catalyst', 'Hyper Beam', 'Spend your mana on a powerful beam toward the cursor. Requires at least 5 mana.', { hyperBeam: 1 }, true),
      ]),
      branch('alchemist', 'Alchemist', '?', 'Transform the effects of every compound.', [
        star('bitter-extract', 'Potency', 'Positive effects on you are 15% stronger; negative effects are 15% weaker.', { effectPower: .15 }),
        star('debilitating-compound', 'Confusing Touch', 'Empty-handed hits confuse enemies for 5s. They attack nearby enemies or become stunned. 12s cooldown; venom drips when ready.', { confusingTouch: 1 }),
        star('venom-mist', 'Beast Flask', 'Drink a flask to transform for 10s: triple damage, 25% faster movement and 40% damage resistance. 40s cooldown.', { beastFlask: 1 }, true),
      ]),
      branch('chef', 'Chef', '?', 'Turn the harvest into a feast.', [
        star('field-dressing', 'Bountiful Harvest', '50% chance to double food and kelp drops.', { foodDouble: .5 }),
        star('naturalists-care', 'Cauldron', 'Craft a cauldron and combine up to three foods into a stew.', { cauldron: 1 }),
        star('purifying-tonic', 'Feast', 'Activate to cycle spinach, garlic and carrot; press again to select. Spinach: +20% damage, garlic: cleanse, carrot: +15% speed and triple jump height. 12s buffs, 30s cooldown.', { feast: 1 }, true),
      ]),
    ],
  },
});
