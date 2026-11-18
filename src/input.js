const movement = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['Space', 'KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
};

export function bindInput(canvas, actions) {
  const keys = new Set();
  const moveKeys = new Set(Object.values(movement).flat());
  const pointer = { x: 0, y: 0, active: false };
  let jump = false;
  let placing = false;
  let miningPointer = null;

  function stopMining() {
    miningPointer = null;
    actions.stopMining();
  }

  function clear() {
    keys.clear();
    jump = false;
    stopMining();
  }

  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width * canvas.width;
    pointer.y = (event.clientY - rect.top) / rect.height * canvas.height;
    pointer.active = pointer.x >= 0 && pointer.x < canvas.width && pointer.y >= 0 && pointer.y < canvas.height;
  }

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const panel = actions.blocked();
    if (code === 'Tab' && !event.shiftKey && (!panel || panel === 'backpack-panel')) {
      event.preventDefault();
      if (!event.repeat) actions.backpack();
      return;
    }
    if (code === 'KeyV' && !event.repeat && panel !== 'room-panel') {
      event.preventDefault();
      actions.character();
      return;
    }
    if (code === 'KeyC' && !event.repeat && panel !== 'room-panel' && panel !== 'customize-panel') {
      event.preventDefault();
      actions.craft();
      return;
    }
    if (panel) return;
    if (code === 'Escape' && !event.repeat) {
      event.preventDefault();
      actions.pause();
      return;
    }
    if (event.target instanceof HTMLButtonElement && code === 'Space') return;
    if (moveKeys.has(code)) {
      event.preventDefault();
      if (!event.repeat && movement.up.includes(code)) jump = true;
      keys.add(code);
    }
    if (event.repeat) return;
    if (code === 'KeyE') actions.collect();
    if (/^Digit[1-4]$/.test(code)) actions.select(Number(code.slice(-1)) - 1);
  });
  window.addEventListener('keyup', ({ code }) => keys.delete(code));
  window.addEventListener('blur', clear);

  canvas.addEventListener('pointermove', (event) => {
    if (miningPointer === null || miningPointer === event.pointerId) locate(event);
  });
  canvas.addEventListener('pointerleave', (event) => {
    if (miningPointer !== null && event.pointerId !== miningPointer) return;
    pointer.active = false;
    stopMining();
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    if (miningPointer !== null && event.pointerId !== miningPointer) return;
    event.preventDefault();
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    locate(event);
    if (event.button === 2 || (event.pointerType === 'touch' && placing)) {
      stopMining();
      actions.place();
      if (event.pointerType === 'touch') pointer.active = false;
      return;
    }
    if (actions.fend()) {
      stopMining();
      if (event.pointerType === 'touch') pointer.active = false;
      else miningPointer = event.pointerId;
      return;
    }
    miningPointer = event.pointerId;
  });

  function releaseMining(event) {
    if (event.pointerId !== miningPointer || (event.type === 'pointerup' && event.button !== 0)) return;
    if (event.pointerType === 'touch') pointer.active = false;
    stopMining();
  }
  window.addEventListener('pointerup', releaseMining);
  window.addEventListener('pointercancel', releaseMining);
  canvas.addEventListener('lostpointercapture', releaseMining);
  window.addEventListener('mouseup', (event) => { if (event.button === 0) stopMining(); });

  for (const button of document.querySelectorAll('[data-hold]')) {
    const key = button.dataset.hold;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (movement.up.includes(key)) jump = true;
      keys.add(key);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(event, () => keys.delete(key));
    }
  }
  document.getElementById('grab').addEventListener('click', actions.collect);
  document.getElementById('touch-mode').addEventListener('click', (event) => {
    stopMining();
    placing = !placing;
    event.currentTarget.textContent = placing ? 'Build' : 'Mine';
    event.currentTarget.setAttribute('aria-pressed', String(placing));
  });

  return {
    pointer,
    clear,
    stopMining,
    holdingMine: () => miningPointer !== null,
    sample() {
      const controls = { jump };
      for (const [direction, codes] of Object.entries(movement)) controls[direction] = codes.some((code) => keys.has(code));
      jump = false;
      return controls;
    },
  };
}
