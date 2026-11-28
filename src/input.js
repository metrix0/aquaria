const movement = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['Space', 'KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
};

export function bindInput(canvas, camera, actions) {
  const keys = new Set();
  const moveKeys = new Set(Object.values(movement).flat());
  const pointer = { x: 0, y: 0, active: false };
  let jump = false;
  let placing = false;
  let miningPointer = null;
  let bowPointer = null;

  function stopMining() {
    miningPointer = null;
    actions.stopMining();
  }

  function clear() {
    keys.clear();
    jump = false;
    bowPointer = null;
    actions.cancelBow?.();
    stopMining();
  }

  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width * camera.width;
    pointer.y = (event.clientY - rect.top) / rect.height * camera.height;
    pointer.active = pointer.x >= 0 && pointer.x < camera.width && pointer.y >= 0 && pointer.y < camera.height;
  }

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const panel = actions.blocked();
    if (panel === 'teleport-panel') {
      if (code === 'KeyT' || code === 'Escape') {
        event.preventDefault();
        if (!event.repeat) actions.teleportMenu?.();
      } else if (/^(Digit|Numpad)[1-9]$/.test(code)) {
        event.preventDefault();
        if (!event.repeat) actions.teleportTo?.(Number(code.slice(-1)) - 1);
      }
      return;
    }
    if (panel === 'items-panel') return;
    if (code === 'Tab' && !event.shiftKey && (!panel || (panel === 'backpack-panel' && !actions.chestOpen()))) {
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
    if (moveKeys.has(code)) {
      event.preventDefault();
      if (!event.repeat && movement.up.includes(code)) jump = true;
      keys.add(code);
    }
    if (code === 'KeyE') keys.add(code);
    if (event.repeat) return;
    if (code === 'KeyE') actions.interact();
    if (code === 'KeyF') actions.castRing();
    if (code === 'KeyG') {
      if (event.shiftKey) actions.cycleFlightSpeed?.();
      else actions.toggleGodMode?.();
    }
    if (code === 'KeyZ') {
      event.preventDefault();
      actions.zoomBy?.(event.shiftKey ? 1 : -1);
    }
    if (code === 'KeyT') {
      event.preventDefault();
      if (event.shiftKey) actions.emotes?.();
      else actions.teleportMenu?.();
    }
    if (code === 'KeyB') actions.dance?.();
    if (code === 'KeyQ') actions.castSkill?.(0);
    if (code === 'KeyR') actions.castSkill?.(1);
    if (/^Digit[1-6]$/.test(code)) actions.select(Number(code.slice(-1)) - 1);
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
    if (bowPointer !== null || (event.button !== 0 && event.button !== 2)) return;
    if (miningPointer !== null && event.pointerId !== miningPointer) return;
    event.preventDefault();
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    locate(event);
    if (event.button === 0 && actions.interactAtPointer()) {
      stopMining();
      if (event.pointerType === 'touch') pointer.active = false;
      return;
    }
    if (event.button === 2 || (event.pointerType === 'touch' && placing)) {
      stopMining();
      actions.place();
      if (event.pointerType === 'touch') pointer.active = false;
      return;
    }
    if (event.button === 0 && !actions.blocked() && actions.beginBow?.()) {
      stopMining(); bowPointer = event.pointerId; canvas.setPointerCapture(event.pointerId); return;
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
    if (event.pointerId === bowPointer) {
      bowPointer = null;
      if (event.type === 'pointerup') { locate(event); actions.releaseBow?.(); }
      else actions.cancelBow?.();
      if (event.pointerType === 'touch') pointer.active = false;
      return;
    }
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
  for (const button of document.querySelectorAll('[data-skill-slot]')) {
    button.addEventListener('click', () => { if (!actions.blocked()) actions.castSkill?.(Number(button.dataset.skillSlot)); });
  }
  const grab = document.getElementById('grab');
  grab.addEventListener('pointerdown', event => { grab.setPointerCapture(event.pointerId); keys.add('KeyE'); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) grab.addEventListener(event, () => keys.delete('KeyE'));
  grab.addEventListener('click', actions.interact);
  document.getElementById('cast-ring').addEventListener('click', () => {
    if (!actions.blocked()) actions.castRing();
  });
  const offhand = document.getElementById('use-hook');
  offhand?.addEventListener('pointerdown', event => {
    if (actions.blocked()) return;
    offhand.setPointerCapture(event.pointerId);
    keys.add('KeyE');
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    offhand?.addEventListener(event, () => keys.delete('KeyE'));
  }
  offhand?.addEventListener('click', () => { if (!actions.blocked()) actions.interact(); });
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
    holdingInteract: () => keys.has('KeyE'),
    holdingDown: () => movement.down.some(code => keys.has(code)),
    sample() {
      const controls = { jump };
      for (const [direction, codes] of Object.entries(movement)) controls[direction] = codes.some((code) => keys.has(code));
      jump = false;
      return controls;
    },
  };
}
