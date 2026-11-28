import { renderConstellation } from './constellation-ui.js';

import { CLASS_DEFS, SKILL_KEYS, unlockedActiveSkills, equippedSkill } from './classes.js';
import { STARTER_CLASS_IDS } from './starter-classes.js';

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


// One deterministic sky per dialog; skill upgrades do not regenerate or restart it.
function createCelestialSky(panel) {
  let seed = 27183;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const stars = [[], [], []];
  for (let i = 0; i < 360; i++) {
    const x = random() * 1600, y = random() * 1000;
    const bright = i % 21 === 0;
    const radius = bright ? 1.15 + random() * .75 : .35 + random() * .7;
    const color = i % 9 === 0 ? '#e9cda7' : i % 5 === 0 ? '#a2c9ff' : '#e0edff';
    const opacity = .22 + random() * .7;
    stars[i % 3].push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`);
    if (bright) stars[i % 3].push(`<path d="M${(x-3.8).toFixed(1)} ${y.toFixed(1)}h7.6M${x.toFixed(1)} ${(y-3.8).toFixed(1)}v7.6" stroke="${color}" stroke-width=".45" opacity=".45"/>`);
  }
  const sky = document.createElement('div');
  sky.className = 'celestial-sky';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = `<div class="sky-nebula"></div><svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">${stars.map((group,i) => `<g class="sky-stars sky-stars-${i}">${group.join('')}</g>`).join('')}</svg><div class="sky-horizon"></div>`;
  panel.prepend(sky);
}

export function createClassesUI(classPanel, treePanel, actions) {
  createCelestialSky(classPanel);
  createCelestialSky(treePanel);
  const classCards = classPanel.querySelector('#class-selection');
  const summary = classPanel.querySelector('#class-summary');
  const tree = treePanel.querySelector('#skilltree-content');


  function loadout(progress) {
    if (!progress.active) return '';
    const skills = unlockedActiveSkills(progress);
    return '<section class="skill-loadout" aria-label="Equipped active skills"><div><strong>Active skills</strong><small>Equip up to two unlocked abilities. Passive skills are always active.</small></div>' +
      SKILL_KEYS.map((key, slot) => {
        const current = equippedSkill(progress, slot)?.id;
        return '<label><kbd>' + key + '</kbd><select aria-label="Equip skill in ' + key + '" data-equip-slot="' + slot + '">' +
          '<option value="">Empty</option>' +
          skills.map(skill => '<option value="' + escapeHtml(skill.id) + '"' + (skill.id === current ? ' selected' : '') + '>' + escapeHtml(skill.name) + '</option>').join('') +
          '</select></label>';
      }).join('') + '</section>';
  }

  function bindLoadout(container, rerender) {
    for (const select of container.querySelectorAll('[data-equip-slot]')) {
      select.addEventListener('change', () => {
        const error = actions.equipSkill(Number(select.dataset.equipSlot), select.value || null);
        if (error) actions.notify(error);
        rerender();
      });
    }
  }

  function renderClasses() {
    const progress = actions.getGame().classes;
    const current = progress.active;
    summary.textContent = current
      ? `Attuned to ${CLASS_DEFS[current].name}. Each class remembers its build. Souls are shared between classes.`
      : 'Choose an ancient calling to awaken your skill tree. Switch freely while testing.';
    const groups = [
      { heading: 'Starting Callings', eyebrow: 'THE FIRST THREE OATHS',
        note: 'Accessible from the beginning. Each remains viable throughout the adventure.',
        ids: STARTER_CLASS_IDS },
      { heading: 'World Discoveries', eyebrow: 'THE FORGOTTEN OATHS',
        note: 'Normally revealed by distant statues. Available here for testing until statues are implemented.',
        ids: Object.keys(CLASS_DEFS).filter((id) => !STARTER_CLASS_IDS.includes(id)) },
    ];
    const card = (def) => `
      <article class="calling-card calling-${def.id} ${current === def.id ? 'is-active' : ''}" style="--soul-accent:${def.accent}">
        <div class="calling-emblem" aria-hidden="true"><span>${def.symbol}</span></div>
        <p class="calling-eyebrow">${def.title}</p>
        <h3>${def.name}</h3><p class="calling-description">${def.description}</p>
        <div class="calling-paths">${def.paths.map((path) => `<span>${path.icon} ${path.name}</span>`).join('')}</div>
        <button type="button" class="calling-choose" data-class="${def.id}" ${current === def.id ? 'disabled' : ''}>${current === def.id ? '✦ Currently attuned' : 'Awaken ' + def.name}</button>
      </article>`;
    classCards.innerHTML = loadout(progress) + groups.map((group) => `
      <section class="calling-group" aria-label="${group.heading}">
        <header class="calling-group-heading"><div><span>${group.eyebrow}</span><h3>${group.heading}</h3></div>
        <p>${group.note}</p></header>
        <div class="calling-group-grid">${group.ids.map((id) => card(CLASS_DEFS[id])).join('')}</div>
      </section>`).join('');
    bindLoadout(classCards, renderClasses);
    for (const button of classCards.querySelectorAll('[data-class]')) button.addEventListener('click', () => {
      const error = actions.chooseClass(button.dataset.class);
      if (error) actions.notify(error);
      renderClasses();
      renderTree();
    });
  }

  function renderTree() {
    const game = actions.getGame(), progress = game.classes;
    const def = CLASS_DEFS[progress.active];
    if (!def) {
      tree.innerHTML = `<div class="skill-empty"><span class="skill-empty-glyph">✧</span><p>THE SOUL REMAINS UNBOUND</p>
        <h3>No class awakened</h3><span>Choose a calling to reveal its constellation of abilities.</span>
        <button type="button" class="soul-action" id="skill-choose-class">Choose a class</button></div>`;
      tree.querySelector('#skill-choose-class').addEventListener('click', actions.openClasses);
      return;
    }
    renderConstellation(tree, actions, tree.dataset.selectedSkill);
  }
  return { renderClasses, renderTree };
}
