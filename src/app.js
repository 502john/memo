/**
 * app.js: wires everything together.
 *
 *   user event → action → setState(changes) → save + render(state)
 *
 * `state` is the only mutable variable in the app. Actions are the only code
 * that changes it, and every change goes through setState.
 *
 *   view        LIBRARY, PRACTICE or READ (read aloud)
 *   passages    saved texts, each with its own reps and ladder progress
 *   settings    saved per device: text size and theme (see state.js)
 *   activeId    passage open in Practice or Read aloud
 *   readStep    which read-aloud view is showing (see state.js READ_VIEWS)
 *   editingId   passage open in the editor (null = adding a new one)
 *   run         the current pass through the text (see state.js)
 *   lastResult  RESULT of the run that just finished
 *   listening   whether the mic is answering instead of the keyboard (see speech.js)
 *   heard       the word the mic is still hearing, previewed in the current word's slot
 *   fullscreen  true or false, or null where the browser can't go fullscreen (iPhone Safari)
 *
 * Typing goes into a hidden <input> (index.html) rather than a keydown
 * listener, because only a focused input opens the on-screen keyboard on phones.
 * Other shortcuts listen on the document: f toggles fullscreen outside Practice
 * (where f is an answer), and in Read aloud ctrl/cmd+enter or → moves on, ← goes back.
 *
 * The "system" theme follows the OS, so render() re-reads it and an OS switch re-renders.
 * The service worker (sw.js) makes the app work offline; where it can't register
 * (plain http, file://) the app simply works online only.
 */

import { App } from './components.js';
import { loadSaved, save, downloadBackup, readBackup } from './storage.js';
import { startListening, stopListening } from './speech.js';
import {
  VIEW, RUN, RESULT, DEFAULT_REPS, SAMPLE_PASSAGE, READ_VIEWS, THEMES,
  restoreSettings, createPassage, restorePassages, replacePassage, mergePassages, newProgress, moveToStep, currentStep,
  startRun, typeKey, sayWord, scoreRun,
} from './state.js';

const root = document.getElementById('app');
const keyboard = document.getElementById('keyboard');
const prefersLight = matchMedia('(prefers-color-scheme: light)');

const saved = loadSaved();

let state = {
  view: VIEW.LIBRARY,
  passages: saved ? restorePassages(saved.passages) : [createPassage(SAMPLE_PASSAGE.title, SAMPLE_PASSAGE.text, DEFAULT_REPS)],
  settings: restoreSettings(saved?.settings),
  activeId: null,
  readStep: 0,
  editingId: null,
  run: null,
  lastResult: null,
  listening: false,
  heard: '',
  fullscreen: document.fullscreenEnabled ? false : null,
};

function setState(changes) {
  state = { ...state, ...changes };
  save(state);
  render();
}

function render() {
  applySettings(state.settings);
  root.replaceChildren(App({ state, actions }));

  if (state.view === VIEW.PRACTICE) {
    keyboard.focus({ preventScroll: true });
    root.querySelector('.word.current')?.scrollIntoView({ block: 'nearest' });
  } else {
    keyboard.blur();
  }
}

const actions = {
  openPassage(id) {
    const passage = findPassage(id);
    setState({ view: VIEW.PRACTICE, activeId: id, run: freshRun(passage), lastResult: null });
  },

  openReadAloud(id) {
    setState({ view: VIEW.READ, activeId: id, readStep: 0 });
  },

  goToReadStep(readStep) {
    setState({ readStep: Math.min(Math.max(readStep, 0), READ_VIEWS.length) });
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
    const progress = text === existing.text ? existing.progress : newProgress();
    setState({ passages: replacePassage(state.passages, { ...existing, title, text, reps, progress }), editingId: null });
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
      setState({ passages: mergePassages(state.passages, restorePassages(backup.passages)) });
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  },

  goToLibrary() {
    stopListening();
    setState({ view: VIEW.LIBRARY, activeId: null, run: null, lastResult: null, listening: false, heard: '' });
  },

  pressKey(char) {
    advanceRun(typeKey(state.run, char));
  },

  sayWords(words) {
    advanceRun(words.reduce(sayWord, state.run));
  },

  continueAfterRun() {
    if (state.lastResult === RESULT.MASTERED) {
      actions.goToLibrary();
      return;
    }
    setState({ run: freshRun(activePassage()), lastResult: null });
  },

  goToStep(step) {
    const passage = activePassage();
    const moved = { ...passage, progress: moveToStep(passage.progress, step) };
    setState({ passages: replacePassage(state.passages, moved), run: freshRun(moved), lastResult: null });
  },

  setReps(reps) {
    setState({ passages: replacePassage(state.passages, { ...activePassage(), reps }) });
  },

  toggleListening() {
    if (state.listening) {
      stopListening();
      setState({ listening: false, heard: '' });
      return;
    }
    startListening({
      onWords: actions.sayWords,
      onHearing: (heard) => heard !== state.heard && setState({ heard }),
      onBlocked: () => {
        setState({ listening: false });
        alert("Microphone access is blocked. Allow it in your browser's site settings to answer out loud.");
      },
    });
    setState({ listening: true });
  },

  focusKeyboard() {
    keyboard.focus({ preventScroll: true });
  },

  setTextSize(textSize) {
    setState({ settings: { ...state.settings, textSize } });
  },

  cycleTheme() {
    const next = THEMES[(THEMES.indexOf(state.settings.theme) + 1) % THEMES.length];
    setState({ settings: { ...state.settings, theme: next } });
  },

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  },
};

function applySettings({ textSize, theme }) {
  const page = document.documentElement;
  page.dataset.theme = theme === 'system' ? (prefersLight.matches ? 'light' : 'dark') : theme;
  page.dataset.textSize = textSize;
}

function findPassage(id) {
  return state.passages.find((passage) => passage.id === id);
}

function activePassage() {
  return findPassage(state.activeId);
}

function freshRun(passage) {
  return startRun(passage.text, currentStep(passage.progress));
}

function advanceRun(run) {
  if (run === state.run) return;
  if (run.status !== RUN.FINISHED) {
    setState({ run });
    return;
  }
  const passage = activePassage();
  const { result, progress } = scoreRun(passage.progress, run, passage.reps);
  setState({ run, lastResult: result, passages: replacePassage(state.passages, { ...passage, progress }) });
}

keyboard.addEventListener('input', () => {
  for (const char of keyboard.value) actions.pressKey(char);
  keyboard.value = '';
});

keyboard.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && state.run?.status === RUN.FINISHED) actions.continueAfterRun();
  if (event.key === 'Escape') actions.goToLibrary();
});

document.addEventListener('keydown', (event) => {
  const isTypingInField = event.target.matches('input, textarea, select');
  if (event.key === 'f' && !isTypingInField && state.fullscreen !== null) actions.toggleFullscreen();

  if (state.view !== VIEW.READ) return;
  const isNext = event.key === 'ArrowRight' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey));
  if (isNext) actions.goToReadStep(state.readStep + 1);
  if (event.key === 'ArrowLeft') actions.goToReadStep(state.readStep - 1);
  if (event.key === 'Escape') actions.goToLibrary();
});

document.addEventListener('fullscreenchange', () => setState({ fullscreen: Boolean(document.fullscreenElement) }));
prefersLight.addEventListener('change', render);
navigator.serviceWorker?.register('sw.js').catch(() => {});

render();
