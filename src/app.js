/**
 * app.js: wires everything together.
 *
 *   user event → action → setState(changes) → save + render(state)
 *
 * `state` is the only mutable variable in the app. Actions are the only code
 * that changes it, and every change goes through setState.
 *
 *   view        LIBRARY or PRACTICE
 *   passages    saved texts, each with its own reps and ladder progress
 *   activeId    passage open in Practice
 *   editingId   passage open in the editor (null = adding a new one)
 *   run         the current pass through the text (see state.js)
 *   lastResult  RESULT of the run that just finished
 *
 * The next run's step comes from the ladder. On a mastered passage, it stays on
 * the step picked for review instead (the previous run's step).
 *
 * Typing goes into a hidden <input> (index.html) rather than a keydown
 * listener, because only a focused input opens the on-screen keyboard on phones.
 */

import { App } from './components.js';
import { loadSaved, save, downloadBackup, readBackup } from './storage.js';
import {
  VIEW, RUN, RESULT, STEPS, DEFAULT_REPS, SAMPLE_PASSAGE,
  createPassage, replacePassage, mergePassages, progressAt, currentStep, isMastered, startRun, typeKey, scoreRun,
} from './state.js';

const root = document.getElementById('app');
const keyboard = document.getElementById('keyboard');

// ─── State ───────────────────────────────────────────────────────────────────

const saved = loadSaved();

let state = {
  view: VIEW.LIBRARY,
  passages: saved?.passages ?? [createPassage(SAMPLE_PASSAGE.title, SAMPLE_PASSAGE.text, DEFAULT_REPS)],
  activeId: null,
  editingId: null,
  run: null,
  lastResult: null,
};

function setState(changes) {
  state = { ...state, ...changes };
  save(state);
  render();
}

function render() {
  root.replaceChildren(App({ state, actions }));

  if (state.view === VIEW.PRACTICE) {
    keyboard.focus({ preventScroll: true });
    root.querySelector('.word.current')?.scrollIntoView({ block: 'nearest' });
  } else {
    keyboard.blur();
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const actions = {
  // Library
  openPassage(id) {
    const passage = findPassage(id);
    setState({ view: VIEW.PRACTICE, activeId: id, run: freshRun(passage), lastResult: null });
  },

  editPassage(id) {
    setState({ editingId: id });
  },

  cancelEdit() {
    setState({ editingId: null });
  },

  savePassage({ title, text, reps }) {
    const existing = findPassage(state.editingId);
    if (!existing) {
      setState({ passages: [...state.passages, createPassage(title, text, reps)] });
      return;
    }
    const progress = text === existing.text ? existing.progress : progressAt(0);
    setState({ passages: replacePassage(state.passages, { ...existing, title, text, progress }), editingId: null });
  },

  deletePassage(id) {
    if (!confirm(`Delete “${findPassage(id).title}”?`)) return;
    setState({ passages: state.passages.filter((passage) => passage.id !== id) });
  },

  exportBackup() {
    downloadBackup(state);
  },

  async importBackup(file) {
    try {
      const backup = await readBackup(file);
      setState({ passages: mergePassages(state.passages, backup.passages) });
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  },

  // Practice
  goToLibrary() {
    setState({ view: VIEW.LIBRARY, activeId: null, run: null, lastResult: null });
  },

  pressKey(char) {
    const run = typeKey(state.run, char);
    if (run === state.run) return;
    if (run.status !== RUN.FINISHED) {
      setState({ run });
      return;
    }
    const passage = activePassage();
    const { result, progress } = scoreRun(passage.progress, run, passage.reps);
    setState({ run, lastResult: result, passages: replacePassage(state.passages, { ...passage, progress }) });
  },

  continueAfterRun() {
    if (state.lastResult === RESULT.MASTERED) {
      actions.goToLibrary();
      return;
    }
    setState({ run: freshRun(activePassage()), lastResult: null });
  },

  reviewStep(stepIndex) {
    if (!isMastered(activePassage().progress)) return;
    setState({ run: startRun(activePassage().text, STEPS[stepIndex]), lastResult: null });
  },

  focusKeyboard() {
    keyboard.focus({ preventScroll: true });
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findPassage(id) {
  return state.passages.find((passage) => passage.id === id);
}

function activePassage() {
  return findPassage(state.activeId);
}

function freshRun(passage) {
  const isReviewing = isMastered(passage.progress) && state.run;
  return startRun(passage.text, isReviewing ? state.run.step : currentStep(passage.progress));
}

// ─── Keyboard ────────────────────────────────────────────────────────────────

keyboard.addEventListener('input', () => {
  for (const char of keyboard.value) actions.pressKey(char);
  keyboard.value = '';
});

keyboard.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && state.run?.status === RUN.FINISHED) actions.continueAfterRun();
  if (event.key === 'Escape') actions.goToLibrary();
});

render();
