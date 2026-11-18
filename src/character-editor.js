import { APPEARANCE, normalizeAppearance, WALK_CYCLE_DISTANCE } from './content.js';
import { createCharacterRenderer } from './character.js';

const fieldsByPart = {
  gender: { label: 'Gender' },
  body: { label: 'Body' },
  hair: { label: 'Hairstyle' },
  skin: { label: 'Skin tone', color: 'face' },
  hairColor: { label: 'Hair color', color: 'base' },
  shirt: { label: 'Shirt color', color: 'base' },
  pants: { label: 'Pants color', color: 'front' },
};

export function createCharacterEditor(panel, onApply) {
  const form = panel.querySelector('form');
  const fields = form.querySelector('.character-fields');
  const canvas = form.querySelector('canvas');
  const walkButton = form.querySelector('#preview-walk');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = canvas.getContext('2d');
  const drawCharacter = createCharacterRenderer(ctx);
  const preview = { x: 18, y: 5, height: 23, grounded: true, facing: 1, dx: 0, walkPhase: 0 };
  let draft;
  let tank;
  let helmet;
  let frame = 0;

  for (const [name, { label, color }] of Object.entries(fieldsByPart)) {
    const choices = APPEARANCE[name];
    if (!color) {
      const container = document.createElement('label');
      container.textContent = label;
      const select = document.createElement('select');
      select.name = name;
      choices.forEach(({ name: text }, index) => select.add(new Option(text, index)));
      container.append(select);
      fields.append(container);
      continue;
    }

    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = label;
    group.append(legend);
    for (const [index, choice] of choices.entries()) {
      const swatch = document.createElement('label');
      swatch.className = 'character-swatch';
      swatch.title = choice.name;
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = index;
      input.setAttribute('aria-label', label + ': ' + choice.name);
      input.style.setProperty('--swatch', choice[color]);
      swatch.append(input);
      group.append(swatch);
    }
    fields.append(group);
  }

  function paint() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCharacter(preview, draft, { tank, helmet });
  }

  function animate(now) {
    preview.walkPhase = (now * 0.08 / WALK_CYCLE_DISTANCE) % 1;
    paint();
    frame = requestAnimationFrame(animate);
  }

  function stopPreview() {
    cancelAnimationFrame(frame);
    preview.dx = 0;
    preview.walkPhase = 0;
    walkButton.setAttribute('aria-pressed', 'false');
  }

  function open(appearance, hasTank, hasHelmet = false) {
    draft = appearance;
    tank = hasTank;
    helmet = hasHelmet;
    for (const [name, value] of Object.entries(appearance)) form.elements.namedItem(name).value = String(value);
    stopPreview();
    walkButton.hidden = reducedMotion.matches;
    paint();
  }

  walkButton.addEventListener('click', () => {
    if (preview.dx) {
      stopPreview();
      paint();
      return;
    }
    preview.dx = 80;
    walkButton.setAttribute('aria-pressed', 'true');
    frame = requestAnimationFrame(animate);
  });

  reducedMotion.addEventListener('change', () => {
    walkButton.hidden = reducedMotion.matches;
    stopPreview();
    if (panel.open) paint();
  });

  form.addEventListener('input', () => {
    draft = normalizeAppearance(Object.fromEntries(Array.from(new FormData(form), ([part, value]) => [part, Number(value)])));
    paint();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onApply(draft);
    panel.close();
  });
  panel.addEventListener('close', () => {
    if (!panel.open) stopPreview();
  });

  return { open };
}
