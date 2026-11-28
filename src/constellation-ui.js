import { CLASS_DEFS, skillBudget, skillCost, SKILL_KEYS, unlockedActiveSkills, equippedSkill } from './classes.js';

// Each consecutive triple follows the silhouette in prerequisite order.
// Outline strokes only bridge separate branches; they never repeat a skill link.
const figures = {
  warden: {
    name: 'The Shield',
    points: [[17,18],[17,46],[30,70],[50,10],[50,45],[50,91],[83,18],[83,46],[70,70]],
    outline: 'M17 18 L50 10 L83 18 M30 70 L50 91 L70 70',
  },
  wayfarer: {
    name: 'The Bow',
    points: [[22,10],[48,20],[64,34],[22,90],[48,80],[64,66],[22,50],[44,50],[91,50]],
    outline: 'M22 10 V50 V90 M64 34 Q77 50 64 66 M82 42 L91 50 L82 58',
  },
  scholar: {
    name: 'The Arcane Staff',
    points: [[50,8],[25,22],[35,43],[75,22],[75,37],[65,49],[50,91],[50,74],[50,57]],
    outline: 'M50 8 L75 22 M35 43 L50 57 L65 49',
  },
  stormborn: {
    name: 'The Thunderbolt',
    points: [[58,8],[29,33],[12,53],[40,53],[28,74],[16,92],[91,38],[63,38],[77,12]],
    outline: 'M12 53 H40 M16 92 L91 38 M77 12 L58 8',
  },
  tideweaver: {
    name: 'The Cresting Wave',
    points: [[10,77],[24,47],[43,25],[62,14],[82,27],[85,49],[65,58],[73,77],[92,80]],
    outline: 'M43 25 Q52 16 62 14 M85 49 Q81 64 65 58 M10 77 Q46 91 92 80',
  },
  stonebound: {
    name: 'The Mountain',
    points: [[8,83],[23,58],[43,14],[42,83],[50,65],[62,45],[92,83],[82,61],[73,23]],
    outline: 'M43 14 L62 45 L73 23 M8 83 H42 H92',
  },
};

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
            <g class="celestial-orbits">
              <ellipse cx="50" cy="50" rx="46" ry="46" stroke-dasharray="18 2 1 2"/>
              <ellipse cx="50" cy="50" rx="41" ry="41" stroke-dasharray=".3 2"/>
              <path d="M50 2v6M50 92v6M2 50h6M92 50h6 M16 16l3 3M81 81l3 3M16 84l3 -3M81 19l3 -3"/>
            </g>
            <path class="celestial-outline" d="${figure.outline}"/>
            ${entries.map((e,i) => e.index ? `<line class="celestial-link ${active.has(e.skill.id) ? 'lit' : ''}" data-branch="${esc(e.branch.id)}" x1="${figure.points[i-1][0]}" y1="${figure.points[i-1][1]}" x2="${figure.points[i][0]}" y2="${figure.points[i][1]}"/>` : '').join('')}
          </svg>
          ${entries.map((e,i) => `<button type="button" class="celestial-star ${state(e).status} ${e.skill.major ? 'major' : ''} ${e.index === 0 ? 'entry-star' : ''} ${figure.points[i][1] >= 75 ? 'label-above' : ''}" style="--x:${figure.points[i][0]}%;--y:${figure.points[i][1]}%" data-skill="${e.skill.id}" aria-label="${esc(e.skill.name)}, ${e.index === 0 ? esc(e.branch.name) + ', ' : ''}${e.skill.major ? 'Greater star' : e.index === 0 ? 'Starting star' : 'Lesser star'}, ${state(e).status}" aria-pressed="false" draggable="${canEquip(e.skill.id)}"><span aria-hidden="true">${e.skill.major ? '&#10037;' : '&#10022;'}</span>${e.index === 0 ? `<small class="entry-label" aria-hidden="true">${esc(e.branch.name)}</small>` : ''}</button>`).join('')}
        </div>
        <div class="celestial-name"><span>${figure.name}</span><small>Begin at any of the three marked stars.</small></div>
        <section class="celestial-souls" aria-label="Soul balances">
          ${['lesser','greater'].map(type => `<div><span class="soul-dot ${type}">&#10022;</span><div><strong>${balance[type]} <small>${type} souls</small></strong></div></div>`).join('')}
        </section>
        <section class="celestial-loadout" aria-label="Equipped active skills">
          <div class="celestial-loadout-head"><strong>Active skills</strong></div>
          <div class="celestial-pool">${castable.map(s => `<button type="button" draggable="true" data-pick-skill="${s.id}" aria-pressed="false">${esc(s.name)}</button>`).join('')}</div>
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
    inspector.innerHTML = `<small class="celestial-path ${skill.major ? 'major' : ''}">${esc(branch.name)} &middot; ${skill.major ? 'Greater star' : index === 0 ? 'Starting star' : 'Lesser star'}</small><span class="celestial-inspector-glyph ${skill.major ? 'major' : ''}" aria-hidden="true">${skill.major ? '&#10037;' : '&#10022;'}</span><h4>${esc(skill.name)}</h4><p>${esc(skill.detail)}</p><div class="celestial-cost">${cost.lesser} lesser ${cost.lesser === 1 ? 'soul' : 'souls'}${cost.greater ? ' + 1 greater soul' : ''}</div>${prerequisite ? `<small>Requires ${esc(branch.nodes[index-1].name)}</small>` : ''}<button type="button" id="awaken-skill" ${status !== 'available' ? 'disabled' : ''}>${status === 'unlocked' ? 'Awakened' : prerequisite ? 'Previous star required' : !affordable ? 'More souls required' : 'Awaken star'}</button>${canEquip(id) ? '<small>Active skill &middot; drag to Q or R</small>' : ''}`;
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
    const branch = byId(id).branch.id;
    for (const b of tree.querySelectorAll('[data-skill]')) {
      b.setAttribute('aria-pressed', String(b.dataset.skill === id));
      b.classList.toggle('path-focused', byId(b.dataset.skill).branch.id === branch);
    }
    for (const link of tree.querySelectorAll('.celestial-link')) link.classList.toggle('path-focused', link.dataset.branch === branch);
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
