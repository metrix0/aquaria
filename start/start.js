import { normalizeAppearance } from '../src/content.js';
import { createCharacterEditor } from '../src/character-editor.js';
import { queueNewGame } from '../src/start-flow.js';

const panel = document.getElementById('customize-panel');
const startButton = document.getElementById('start-game');
const backButton = document.getElementById('back-menu');
const fade = document.getElementById('page-fade');
const status = document.getElementById('menu-message');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let leaving = false;
let noticeTimeout;

function note(message) {
  status.textContent = message;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { status.textContent = ''; }, 3500);
}

const editor = createCharacterEditor(panel, (appearance) => {
  if (leaving) return;
  if (!queueNewGame(appearance)) {
    note('This browser could not prepare a new game. Please enable session storage.');
    return;
  }
  leaving = true;
  fade.classList.add('visible');
  setTimeout(() => { location.assign('/'); }, reduceMotion ? 50 : 760);
});

startButton.addEventListener('click', () => {
  if (leaving) return;
  try {
    if (localStorage.getItem('aquaria.save') &&
        !confirm('Start a new adventure? Your current browser autosave will be replaced.')) return;
  } catch {
    // A disabled autosave does not prevent a new session.
  }
  editor.open(normalizeAppearance());
  panel.showModal();
});
backButton.addEventListener('click', () => panel.close());
document.getElementById('load-game').addEventListener('click', () => note('Save selection is coming soon.'));
document.getElementById('game-options').addEventListener('click', () => note('Game options are coming soon.'));
