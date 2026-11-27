// Shared spell definitions for items, loot, casting and saves.
export const SPELLS = {
  firebolt: { name: 'Firebolt', damage: 7, speed: 240, cooldown: 8, color: '#ff9857', detail: 'Launches a fiery bolt for 7 damage.' },
  'frost-lance': { name: 'Frost Lance', damage: 4, speed: 300, cooldown: 12, root: 2, color: '#8dddf5', detail: 'Launches an icy lance for 4 damage and roots enemies for 2 seconds.' },
  mend: { name: 'Mend', heal: 15, cooldown: 30, color: '#9ce6a3', detail: 'Restores 15 health.' },
};
export const SPELL_ITEMS = Object.fromEntries(Object.entries(SPELLS).flatMap(([id, spell]) =>
  ['tome', 'scroll'].map(form => [id + '-' + form, {
    name: spell.name + ' ' + form, spell: id, form,
    description: spell.detail + (form === 'tome' ? ' Reusable; ' + spell.cooldown + 's cooldown.' : ' Consumed on use.'),
  }])));
export function spellCooldown(game, item) {
  return item?.form === 'tome' ? Math.max(0, (game.spellReadyAt?.[item.spell] ?? 0) - game.elapsed) : 0;
}
export function restoreSpellCooldowns(saved) {
  return Object.fromEntries(Object.entries(SPELLS).map(([id, spell]) => [
    id, Number.isFinite(saved?.[id]) ? Math.max(0, Math.min(spell.cooldown, saved[id])) : 0,
  ]));
}
