import { appearanceOptions, createCharacterRenderer, normalizeAppearance, WALK_CYCLE_DISTANCE } from './character.js';

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
  let frame = 0;

  for (const [name, { label, choices, colors }] of Object.entries(appearanceOptions)) {
    if (!colors) {
      const container = document.createElement('label');
      container.textContent = label;
      const select = document.createElement('select');
      select.name = name;
      for (const [key, text] of Object.entries(choices)) select.add(new Option(text, key));
      container.append(select);
      fields.append(container);
      continue;
    }

    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = label;
    group.append(legend);
    for (const [key, text] of Object.entries(choices)) {
      const swatch = document.createElement('label');
      swatch.className = 'swatch';
      swatch.title = text;
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = key;
      input.setAttribute('aria-label', text);
      input.style.setProperty('--swatch', colors[key][1]);
      swatch.append(input);
      group.append(swatch);
    }
    fields.append(group);
  }

  function paint() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCharacter(preview, draft);
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

  function open(appearance) {
    draft = appearance;
    for (const [name, value] of Object.entries(appearance)) form.elements.namedItem(name).value = value;
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
    draft = normalizeAppearance(Object.fromEntries(new FormData(form)));
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
