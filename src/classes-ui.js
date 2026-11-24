
import { CLASS_DEFS, skillBudget, skillCost, SOUL_ITEMS } from './classes.js';

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createClassesUI(classPanel, treePanel, actions) {
  const classCards = classPanel.querySelector('#class-selection');
  const summary = classPanel.querySelector('#class-summary');
  const tree = treePanel.querySelector('#skilltree-content');
  let highlighted = null;

  function renderClasses() {
    const progress = actions.getGame().classes;
    const current = progress.active;
    summary.textContent = current
      ? `Attuned to ${CLASS_DEFS[current].name}. Each class remembers its build. Souls are shared between classes.`
      : 'Choose an ancient calling to awaken your skill tree. Switch freely while testing.';
    classCards.innerHTML = Object.values(CLASS_DEFS).map((def) => `
      <article class="calling-card calling-${def.id} ${current === def.id ? 'is-active' : ''}" style="--soul-accent:${def.accent}">
        <div class="calling-emblem" aria-hidden="true"><span>${def.symbol}</span></div>
        <p class="calling-eyebrow">${def.title}</p>
        <h3>${def.name}</h3><p class="calling-description">${def.description}</p>
        <div class="calling-paths">${def.paths.map((path) => `<span>${path.icon} ${path.name}</span>`).join('')}</div>
        <button type="button" class="calling-choose" data-class="${def.id}" ${current === def.id ? 'disabled' : ''}>${current === def.id ? '✦ Currently attuned' : 'Awaken ' + def.name}</button>
      </article>`).join('');
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
    const balance = skillBudget(progress);
    const active = new Set(progress.builds[def.id]);
    const earned = progress.total;
    const selected = def.paths.flatMap((p) => p.nodes).find((n) => n.id === highlighted)
      || def.paths[0].nodes[0];
    highlighted = selected.id;
    const owned = { lesser: game.inventory.count(SOUL_ITEMS.lesser), greater: game.inventory.count(SOUL_ITEMS.greater) };
    const branches = def.paths.map((branch) => `
      <section class="star-branch" aria-label="${branch.name}">
        <div class="star-branch-head"><span class="star-branch-icon">${branch.icon}</span><div>
          <strong>${branch.name}</strong><small>${branch.description}</small></div></div>
        <div class="star-route">
          <svg class="star-route-lines" viewBox="0 0 140 390" preserveAspectRatio="none" aria-hidden="true">
            <path d="M70 61 Q38 125 70 195 T70 324" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 4"/>
            <path d="M70 59 L40 110 L70 195 L102 250 L70 325" fill="none" stroke="currentColor" stroke-width=".55" opacity=".45"/>
            <circle cx="42" cy="82" r="1.5" fill="currentColor"/><circle cx="92" cy="174" r="1" fill="currentColor"/>
          </svg>
          ${branch.nodes.map((skill, index) => {
            const unlocked = active.has(skill.id);
            const eligible = !index || active.has(branch.nodes[index - 1].id);
            const affordable = balance.lesser >= skillCost(skill).lesser && balance.greater >= skillCost(skill).greater;
            const state = unlocked ? 'unlocked' : eligible && affordable ? 'available' : 'locked';
            return `<button type="button" data-skill="${skill.id}" class="star-node star-node--${index} ${skill.major ? 'major' : 'minor'} ${state} ${highlighted === skill.id ? 'selected' : ''}" aria-pressed="${highlighted === skill.id}" aria-label="${escapeHtml(skill.name)}, ${skill.major ? 'Greater' : 'Lesser'} Soul skill, ${state}">
              <span class="star-halo"><span class="star-glyph">${skill.major ? '✦' : '✧'}</span></span>
              <span class="star-node-name">${escapeHtml(skill.name)}</span>
              <span class="star-state">${unlocked ? 'AWAKENED' : skill.major ? 'GREATER SOUL' : 'LESSER SOUL'}</span>
            </button>`;
          }).join('')}
        </div>
      </section>`).join('');
    const branch = def.paths.find((p) => p.nodes.includes(selected));
    const index = branch.nodes.indexOf(selected);
    const purchased = active.has(selected.id), cost = skillCost(selected);
    const prerequisite = index > 0 && !active.has(branch.nodes[index - 1].id);
    const canBuy = !purchased && !prerequisite && balance.lesser >= cost.lesser && balance.greater >= cost.greater;
    const buttonLabel = purchased ? 'Skill awakened' : prerequisite ? 'Requires previous star'
      : balance.lesser < cost.lesser || balance.greater < cost.greater ? 'More souls required' : 'Awaken this star';
    tree.innerHTML = `
      <header class="skilltree-banner" style="--soul-accent:${def.accent}">
        <div class="skilltree-banner-emblem" aria-hidden="true">${def.symbol}</div>
        <div class="skilltree-banner-copy"><p>THE ANCIENT CONSTELLATIONS · ${def.title.toUpperCase()}</p><h3>${def.name}</h3>
          <span>${def.description}</span></div>
        <div class="skilltree-switch"><button type="button" id="skilltree-switch-class">Change class</button></div>
      </header>
      <div class="soul-ledger" aria-label="Soul balances">
        ${['lesser', 'greater'].map((type) => `<div class="soul-ledger-item ${type}">
          <span class="soul-ledger-glyph">${type === 'lesser' ? '✧' : '✦'}</span><div>
            <small>${type.toUpperCase()} SOULS</small><strong>${balance[type]} <i>/ ${earned[type]} attuned</i></strong></div>
          <button type="button" data-absorb="${type}" ${!owned[type] ? 'disabled' : ''} title="Absorb soul items from your backpack">${owned[type] ? 'Absorb ' + owned[type] : 'None in bag'}</button>
        </div>`).join('')}
      </div>
      <div class="constellation" style="--soul-accent:${def.accent}">
        <div class="constellation-sky" aria-hidden="true"></div>
        <div class="constellation-heading"><span>✧ &nbsp; PATHS OF ASCENSION &nbsp; ✧</span>
        <p>Follow a path. Greater stars require a boss soul and two lesser souls.</p></div>
        <div class="constellation-branches">${branches}</div>
      </div>
      <section class="star-inspector" style="--soul-accent:${def.accent}" aria-label="Selected skill">
        <div class="inspector-emblem ${selected.major ? 'major' : ''}">${selected.major ? '✦' : '✧'}</div>
        <div class="inspector-copy"><small>${branch.name.toUpperCase()} · ${selected.major ? 'GREATER STAR' : 'LESSER STAR'}</small><h4>${escapeHtml(selected.name)}</h4>
          <p>${escapeHtml(selected.detail)}</p><span class="inspector-cost">${cost.lesser} ✧ Lesser ${cost.greater ? ' · ' + cost.greater + ' ✦ Greater' : ''}</span></div>
        <button type="button" id="awaken-skill" class="soul-action" ${!canBuy ? 'disabled' : ''}>${buttonLabel}</button>
      </section>
      <p class="skilltree-footnote">Soul items come from minibosses and bosses. Attuned souls are shared, but each class keeps its build.</p>`;
    tree.querySelector('#skilltree-switch-class').addEventListener('click', actions.openClasses);
    for (const button of tree.querySelectorAll('[data-skill]')) button.addEventListener('click', () => {
      highlighted = button.dataset.skill;
      renderTree();
    });
    for (const button of tree.querySelectorAll('[data-absorb]')) button.addEventListener('click', () => {
      const type = button.dataset.absorb;
      const error = actions.absorbSoul(type, owned[type]);
      if (error) actions.notify(error);
      renderTree();
    });
    tree.querySelector('#awaken-skill').addEventListener('click', () => {
      const error = actions.unlockSkill(highlighted);
      if (error) actions.notify(error);
      renderTree();
    });
  }
  return { renderClasses, renderTree };
}
