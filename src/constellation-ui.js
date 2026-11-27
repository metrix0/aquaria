import { CLASS_DEFS, skillBudget, skillCost, SKILL_KEYS, unlockedActiveSkills, equippedSkill } from './classes.js';

// Each consecutive triple is a prerequisite path. Fainter strokes complete the silhouette,
// without implying additional gameplay prerequisites.
const figures = {
  warden: { name: 'The Shield', points: [[18,20],[15,50],[30,76],[50,15],[50,48],[50,91],[82,20],[85,50],[70,76]], outline: 'M18 20 L50 15 L82 20 L85 50 L70 76 L50 91 L30 76 L15 50 Z M15 50 H85 M50 15 V91' },
  wayfarer: { name: 'The Bow', points: [[22,15],[61,24],[80,50],[22,50],[49,50],[94,50],[22,85],[61,76],[22,70]], outline: 'M22 15 Q92 19 80 50 Q92 81 22 85 L22 15 M22 50 H94 M86 42 L94 50 L86 58 M22 85 L61 76 L80 50' },
  scholar: { name: 'The Arcane Staff', points: [[50,78],[50,48],[50,10],[50,33],[30,22],[24,6],[50,63],[70,22],[76,6]], outline: 'M50 92 V10 M24 6 L30 22 L50 33 L70 22 L76 6 M24 6 L50 10 L76 6 M50 78 L43 90 L57 90 Z' },
  stormborn: { name: 'The Thunderbolt', points: [[51,9],[31,34],[15,57],[70,10],[53,39],[81,41],[40,57],[29,76],[20,92]], outline: 'M51 9 L70 10 L53 39 L81 41 L20 92 L40 57 L15 57 Z' },
  tideweaver: { name: 'The Cresting Wave', points: [[12,74],[27,46],[47,21],[47,21],[68,15],[83,36],[76,53],[61,46],[91,78]], outline: 'M12 74 Q20 39 47 21 Q69 3 83 36 Q89 59 61 46 Q70 77 91 78 M12 74 Q49 96 91 78' },
  stonebound: { name: 'The Mountain', points: [[9,83],[27,49],[42,23],[42,23],[53,9],[72,49],[72,49],[83,62],[94,83]], outline: 'M9 83 L42 23 L53 9 L72 49 L83 62 L94 83 Z M27 49 L42 40 L53 49 L63 34 M42 23 L53 9' },
};
// Keep every interactive star distinct, including where branches meet visually.
figures.tideweaver.points[3] = [52,35];
figures.stonebound.points[3] = [48,58];
figures.stonebound.points[6] = [69,72];

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const starfield = Array.from({length: 95}, (_, i) => {
  const x = (i * 73.73 + 11) % 100, y = (i * i * 19.17 + i * 13.1) % 100;
  return `<circle cx="${x}" cy="${y}" r="${i % 13 === 0 ? .23 : .09}" opacity="${.18 + (i % 7) * .085}"/>`;
}).join('');

export function renderConstellation(tree, actions, previous) {
  const game = actions.getGame(), progress = game.classes, def = CLASS_DEFS[progress.active];
  const figure = figures[def.id];
  const entries = def.paths.flatMap(branch => branch.nodes.map((skill, index) => ({skill, branch, index})));
  const byId = id => entries.find(e => e.skill.id === id);
  let selected = byId(previous)?.skill.id ?? entries[0].skill.id;
  let pending = null;
  const active = new Set(progress.builds[def.id]);
  const castable = unlockedActiveSkills(progress);
  const canEquip = id => castable.some(skill => skill.id === id);
  const balance = skillBudget(progress);
  const state = ({skill, branch, index}) => {
    const cost = skillCost(skill);
    const prerequisite = index > 0 && !active.has(branch.nodes[index-1].id);
    const affordable = balance.lesser >= cost.lesser && balance.greater >= cost.greater;
    return { cost, prerequisite, affordable, status: active.has(skill.id) ? 'unlocked' : !prerequisite && affordable ? 'available' : 'locked' };
  };
  const rerender = () => renderConstellation(tree, actions, selected);
  const assign = (slot, id) => {
    const error = actions.equipSkill(slot, id);
    if (error) actions.notify(error);
    rerender();
  };
  tree.innerHTML = `<div class="celestial-tree" style="--soul-accent:${def.accent}">
    <header class="celestial-header"><div><small>${esc(def.title)}</small><h3>${esc(def.name)}</h3></div></header>
    <div class="celestial-layout">
      <div class="celestial-main">
        <div class="celestial-map" aria-label="${figure.name} constellation">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <g fill="#d6eaff">${starfield}</g>
            <path class="celestial-outline" d="${figure.outline}"/>
            ${entries.map((e,i) => e.index ? `<line class="celestial-link ${active.has(e.skill.id) ? 'lit' : ''}" x1="${figure.points[i-1][0]}" y1="${figure.points[i-1][1]}" x2="${figure.points[i][0]}" y2="${figure.points[i][1]}"/>` : '').join('')}
          </svg>
          ${entries.map((e,i) => `<button type="button" class="celestial-star ${state(e).status} ${e.skill.major ? 'major' : ''}" style="--x:${figure.points[i][0]}%;--y:${figure.points[i][1]}%" data-skill="${e.skill.id}" aria-label="${esc(e.skill.name)}, ${e.skill.major ? 'Greater star' : 'Lesser star'}, ${state(e).status}" aria-pressed="false" draggable="${canEquip(e.skill.id)}"><span aria-hidden="true">${e.skill.major ? '&#10037;' : '&#10022;'}</span></button>`).join('')}
        </div>
        <p class="celestial-name">${figure.name}</p>
        <section class="celestial-souls" aria-label="Soul balances">
          ${['lesser','greater'].map(type => `<div><span class="soul-dot ${type}">&#10022;</span><div><strong>${balance[type]} <small>${type} souls</small></strong></div></div>`).join('')}
        </section>
        <section class="celestial-loadout" aria-label="Equipped active skills">
          <div class="celestial-loadout-head"><strong>Active skills</strong><small>Drag an unlocked skill to Q or R, or select it then tap a slot.</small></div>
          <div class="celestial-pool">${castable.map(s => `<button type="button" draggable="true" data-pick-skill="${s.id}" aria-pressed="false">${esc(s.name)}</button>`).join('') || '<small>No active skills awakened yet.</small>'}</div>
          <div class="celestial-slots">${SKILL_KEYS.map((key, slot) => {
            const current = equippedSkill(progress, slot);
            return `<div class="celestial-slot" data-drop-slot="${slot}"><button type="button" data-equip-slot="${slot}" aria-label="Assign skill to ${key}"><kbd>${key}</kbd><span>${esc(current?.name ?? 'Empty')}</span></button>${current ? `<button type="button" data-clear-slot="${slot}" aria-label="Clear ${key}">&times;</button>` : ''}</div>`;
          }).join('')}</div>
        </section>
      </div>
      <aside class="celestial-inspector" aria-label="Skill details"></aside>
    </div>
  </div>`;
  const inspector = tree.querySelector('.celestial-inspector');
  let inspected;
  function inspect(id) {
    if (inspected === id) return;
    inspected = id;
    const e = byId(id);
    const {skill,branch,index} = e;
    const {cost,prerequisite,affordable,status} = state(e);
    inspector.innerHTML = `<small class="celestial-path ${skill.major ? 'major' : ''}">${esc(branch.name)} &middot; ${skill.major ? 'Greater star' : 'Lesser star'}</small><span class="celestial-inspector-glyph ${skill.major ? 'major' : ''}" aria-hidden="true">${skill.major ? '&#10037;' : '&#10022;'}</span><h4>${esc(skill.name)}</h4><p>${esc(skill.detail)}</p><div class="celestial-cost">${cost.lesser} lesser ${cost.lesser === 1 ? 'soul' : 'souls'}${cost.greater ? ' + 1 greater soul' : ''}</div>${prerequisite ? `<small>Requires ${esc(branch.nodes[index-1].name)}</small>` : ''}<button type="button" id="awaken-skill" ${status !== 'available' ? 'disabled' : ''}>${status === 'unlocked' ? 'Awakened' : prerequisite ? 'Previous star required' : !affordable ? 'More souls required' : 'Awaken star'}</button>${canEquip(id) ? '<small>Active skill &middot; drag to Q or R</small>' : ''}`;
    inspector.querySelector('#awaken-skill').addEventListener('click', () => {
      const error = actions.unlockSkill(id);
      if (error) actions.notify(error);
      selected = id; tree.dataset.selectedSkill = id;
      rerender();
    });
  }
  function select(id) {
    selected = id; tree.dataset.selectedSkill = id;
    pending = canEquip(id) ? id : null;
    for (const b of tree.querySelectorAll('[data-skill]')) b.setAttribute('aria-pressed', String(b.dataset.skill === id));
    for (const b of tree.querySelectorAll('[data-pick-skill]')) b.setAttribute('aria-pressed', String(b.dataset.pickSkill === pending));
    inspect(id);
  }
  select(selected);
  for (const b of tree.querySelectorAll('[data-skill], [data-pick-skill]')) {
    const id = b.dataset.skill || b.dataset.pickSkill;
    b.addEventListener('click', () => select(id));
    if (b.dataset.skill) {
      b.addEventListener('pointerenter', () => inspect(id));
      b.addEventListener('pointerleave', () => inspect(selected));
      b.addEventListener('focus', () => inspect(id));
      b.addEventListener('blur', () => inspect(selected));
    }
    b.addEventListener('dragstart', event => {
      if (!canEquip(id)) { event.preventDefault(); return; }
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.effectAllowed = 'move';
      select(id);
    });
  }
  for (const slot of tree.querySelectorAll('[data-drop-slot]')) {
    const index = Number(slot.dataset.dropSlot);
    slot.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; slot.classList.add('drop-ready'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-ready'));
    slot.addEventListener('drop', event => {
      event.preventDefault(); slot.classList.remove('drop-ready');
      const id = event.dataTransfer.getData('text/plain');
      if (canEquip(id)) { selected = id; assign(index, id); }
    });
    slot.querySelector('[data-equip-slot]').addEventListener('click', () => {
      if (pending) assign(index, pending);
      else actions.notify('Select an unlocked active skill first.');
    });
    slot.querySelector('[data-clear-slot]')?.addEventListener('click', () => assign(index, null));
  }
}
