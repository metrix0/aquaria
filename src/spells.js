// Shared spell definitions; legacy firebolt IDs remain valid in saves.
export const SPELLS = {
  firebolt: { name: 'Fireball', damage: 12, splash: 8, radius: 44, speed: 220, cooldown: 8, color: '#ff9857', cover: '#b64e43', detail: 'Explodes on contact for 12 direct and up to 8 splash damage.' },
  'frost-lance': { name: 'Frost Lance', damage: 7, speed: 330, cooldown: 10, root: 3, pierce: 2, color: '#8dddf5', cover: '#4a83ab', detail: 'Pierces up to three enemies and freezes them for 3 seconds.' },
  mend: { name: 'Mend', heal: 20, range: 128, cooldown: 18, color: '#9ce6a3', cover: '#538c63', detail: 'Restores 20 health to an ally aimed at within 8 blocks; otherwise heals you.' },
  'storm-arc': { name: 'Storm Arc', damage: 9, speed: 400, chain: 3, radius: 68, cooldown: 12, color: '#e9d38a', cover: '#9270b6', detail: 'Lightning jumps to up to two additional nearby enemies with diminishing damage.' },
  'tidal-pulse': { name: 'Tidal Pulse', damage: 8, radius: 56, cooldown: 9, color: '#76e2dc', cover: '#347e8c', detail: 'A close-range shockwave damages and pushes enemies away in every direction.' },
};
export const SPELL_ITEMS = Object.fromEntries(Object.entries(SPELLS).flatMap(([id, spell]) =>
  ['tome', 'scroll'].map(form => [id + '-' + form, {
    name: spell.name + ' ' + form, spell: id, form,
    description: spell.detail + (form === 'tome' ? ' Reusable; triggers a ' + spell.cooldown + 's shared tome cooldown.' : ' Consumed on use.'),
  }])));
export function spellCooldown(game, item) {
  if (item?.form !== 'tome') return 0;
  // Keep the original per-spell save fields; every tome reads the latest deadline.
  // This also migrates earlier saves without shortening an active cooldown.
  const ready = Math.max(0, ...Object.keys(SPELLS).map(id=>Number.isFinite(game.spellReadyAt?.[id]) ? game.spellReadyAt[id] : 0));
  return Math.max(0, ready - game.elapsed);
}
export function restoreSpellCooldowns(saved) {
  return Object.fromEntries(Object.entries(SPELLS).map(([id, spell]) => [
    id, Number.isFinite(saved?.[id]) ? Math.max(0, Math.min(spell.cooldown, saved[id])) : 0,
  ]));
}
