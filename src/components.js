/**
 * components.js: the UI. Each component is a function that takes one props
 * object and returns a DOM element. Components never change state directly.
 * They call the callbacks (actions) they are given.
 *
 *   App
 *   ├── Library
 *   │   ├── BackupButtons
 *   │   ├── PassageCard (one per passage)
 *   │   └── PassageEditor → RepsPicker
 *   └── Practice
 *       ├── StepLadder
 *       ├── StreakDots
 *       ├── RunText → Word (one per word)
 *       └── RunSummary
 */

import { el, classes } from './dom.js';
import {
  VIEW, INPUT, RUN, WORD, RESULT, STEPS, REPS_OPTIONS, DEFAULT_REPS,
  currentStep, isMastered,
} from './state.js';

// ─── App ─────────────────────────────────────────────────────────────────────

const VIEWS = {
  [VIEW.LIBRARY]: Library,
  [VIEW.PRACTICE]: Practice,
};

export function App({ state, actions }) {
  return el('div', { class: 'app' },
    el('header', { class: 'top' },
      el('h1', { class: 'brand' }, 'Memo'),
      el('span', { class: 'muted' }, 'memorize anything by typing it')),
    VIEWS[state.view]({ state, actions }));
}

// ─── Library ─────────────────────────────────────────────────────────────────

function Library({ state, actions }) {
  const editing = state.passages.find((passage) => passage.id === state.editingId);

  return el('section', { class: 'library' },
    el('div', { class: 'section-head' },
      el('h2', {}, 'Your passages'),
      BackupButtons({ onExport: actions.exportBackup, onImport: actions.importBackup })),
    el('ul', { class: 'cards' },
      state.passages.map((passage) => PassageCard({
        passage,
        onOpen: () => actions.openPassage(passage.id),
        onEdit: () => actions.editPassage(passage.id),
        onDelete: () => actions.deletePassage(passage.id),
      }))),
    PassageEditor({ passage: editing, onSave: actions.savePassage, onCancel: actions.cancelEdit }),
    el('p', { class: 'note' },
      'Everything is stored in this browser only. Use Export to back up or move to another device.'));
}

function BackupButtons({ onExport, onImport }) {
  return el('div', { class: 'row' },
    el('button', { type: 'button', onclick: onExport }, 'Export'),
    el('label', { class: 'button' }, 'Import',
      el('input', {
        type: 'file',
        accept: '.json,application/json',
        hidden: true,
        onchange: (event) => onImport(event.target.files[0]),
      })));
}

function PassageCard({ passage, onOpen, onEdit, onDelete }) {
  return el('li', { class: 'card' },
    el('button', { type: 'button', class: 'card-main', onclick: onOpen },
      el('strong', {}, passage.title),
      el('span', { class: 'muted' }, progressLabel(passage.progress))),
    el('button', { type: 'button', onclick: onEdit }, 'Edit'),
    el('button', { type: 'button', class: 'danger', onclick: onDelete }, 'Delete'));
}

/** Add a passage when `passage` is undefined, otherwise edit it. Reps are locked once added. */
function PassageEditor({ passage, onSave, onCancel }) {
  const isEditing = Boolean(passage);

  function submit(event) {
    event.preventDefault();
    const { title, text, reps } = event.target.elements;
    onSave({ title: title.value.trim(), text: text.value.trim(), reps: Number(reps.value) });
  }

  return el('form', { class: 'editor', onsubmit: submit },
    el('h3', {}, isEditing ? `Edit “${passage.title}”` : 'Add a passage'),
    el('input', { name: 'title', placeholder: 'Title, e.g. Psalm 23', required: true, value: passage?.title }),
    el('textarea', { name: 'text', rows: 6, placeholder: 'Paste the text you want to memorize…', required: true },
      passage?.text),
    RepsPicker({ reps: passage?.reps ?? DEFAULT_REPS, isLocked: isEditing }),
    isEditing && el('p', { class: 'note' }, "Reps can't be changed. Changing the text resets this passage's progress."),
    el('div', { class: 'row' },
      el('button', { type: 'submit', class: 'primary' }, isEditing ? 'Save changes' : 'Add passage'),
      isEditing && el('button', { type: 'button', onclick: onCancel }, 'Cancel')));
}

function RepsPicker({ reps, isLocked }) {
  return el('label', { class: 'reps' }, 'Clean runs needed per step ',
    el('select', { name: 'reps', disabled: isLocked },
      REPS_OPTIONS.map((option) => el('option', { value: option, selected: option === reps }, option))));
}

// ─── Practice ────────────────────────────────────────────────────────────────

function Practice({ state, actions }) {
  const passage = state.passages.find((p) => p.id === state.activeId);
  const { progress, reps } = passage;
  const justCompletedStep = [RESULT.LEVEL_UP, RESULT.MASTERED].includes(state.lastResult);

  return el('section', { class: 'practice', onclick: actions.focusKeyboard },
    el('div', { class: 'section-head' },
      el('h2', {}, passage.title),
      el('button', { type: 'button', onclick: actions.goToLibrary }, '← All passages')),
    StepLadder({ progress, activeStep: state.run.step, onPick: actions.reviewStep }),
    el('div', { class: 'meta' },
      el('span', { class: 'muted' }, state.run.step.hint),
      StreakDots({ cleanRuns: justCompletedStep ? reps : progress.cleanRuns, reps })),
    el('div', { class: 'text-box' }, RunText({ run: state.run })),
    state.run.status === RUN.FINISHED && RunSummary({
      result: state.lastResult,
      run: state.run,
      progress,
      reps,
      onContinue: actions.nextRun,
    }),
    el('p', { class: 'note' }, 'Esc goes back to your passages.'));
}

function StepLadder({ progress, activeStep, onPick }) {
  const isLocked = !isMastered(progress);

  return el('nav', {
    class: 'ladder',
    'aria-label': 'Steps',
    title: isLocked ? 'Steps unlock for review once the passage is memorized.' : 'Pick a step to review.',
  },
  STEPS.map((step, i) => el('button', {
    type: 'button',
    class: classes('rung', step === activeStep && 'active', i < progress.step && 'done'),
    disabled: isLocked,
    onclick: () => onPick(i),
  }, stepName(step))));
}

function StreakDots({ cleanRuns, reps }) {
  return el('span', { class: 'dots', title: `${cleanRuns} of ${reps} clean runs in a row` },
    Array.from({ length: reps }, (_, i) => el('span', { class: classes('dot', i < cleanRuns && 'filled') })));
}

// ─── Run text ────────────────────────────────────────────────────────────────

/**
 * How a word is drawn. Each look is also its CSS class in style.css.
 *   CORRECT, MISSED  answered (missed words are revealed in red)
 *   UPCOMING         not reached, shown faintly as a hint
 *   BLANK            not reached and hidden, drawn as an empty line (modes 1–2)
 *   INVISIBLE        not reached and hidden, not drawn at all (mode 3)
 *   TYPING           the word being typed letter by letter (mode 3)
 */
const LOOK = {
  CORRECT: 'correct',
  MISSED: 'missed',
  UPCOMING: 'upcoming',
  BLANK: 'blank',
  INVISIBLE: 'invisible',
  TYPING: 'typing',
};

function lookOf(run, index) {
  const word = run.words[index];
  const isWholeWord = run.step.input === INPUT.WHOLE_WORD;

  if (word.result === WORD.CORRECT) return LOOK.CORRECT;
  if (word.result === WORD.MISSED) return LOOK.MISSED;
  if (index === run.cursor && isWholeWord) return LOOK.TYPING;
  if (!word.hidden) return LOOK.UPCOMING;
  return isWholeWord ? LOOK.INVISIBLE : LOOK.BLANK;
}

function RunText({ run }) {
  return el('p', { class: 'passage' },
    run.words.map((word, i) => {
      const look = lookOf(run, i);
      if (look === LOOK.INVISIBLE) return null;
      return [
        LineBreaks({ count: word.lineBreaksBefore }),
        Word({
          word,
          look,
          typed: run.typed,
          wrongLetter: run.wrongLetter,
          isCurrent: i === run.cursor,
          justAnswered: i === run.lastAnswered,
        }),
        ' ',
      ];
    }));
}

function Word({ word, look, typed, wrongLetter, isCurrent, justAnswered }) {
  const content = {
    [LOOK.TYPING]: [typed, wrongLetter && el('span', { class: 'wrong-letter' }, wrongLetter)],
    [LOOK.BLANK]: '',
  }[look] ?? word.text;

  return el('span', {
    class: classes('word', look, isCurrent && 'current', justAnswered && 'reveal'),
    style: `--letters: ${word.text.length}`,
  }, content);
}

function LineBreaks({ count }) {
  return Array.from({ length: count }, () => el('br'));
}

// ─── Run summary ─────────────────────────────────────────────────────────────

const SUMMARY_MESSAGE = {
  [RESULT.FAILED]: ({ run }) =>
    `${plural(run.misses, 'word')} missed. This run doesn't count and your streak resets. Go again.`,
  [RESULT.CLEAN]: ({ progress, reps }) =>
    `Clean run! ${progress.cleanRuns} of ${reps}.`,
  [RESULT.LEVEL_UP]: ({ progress }) =>
    `Step complete! Next: ${stepName(currentStep(progress))}.`,
  [RESULT.MASTERED]: () =>
    'Memorized! You typed the whole thing from memory. 🎉',
};

function RunSummary({ result, run, progress, reps, onContinue }) {
  return el('div', { class: classes('summary', result), role: 'status' },
    el('p', {}, SUMMARY_MESSAGE[result]({ run, progress, reps })),
    el('button', { type: 'button', class: 'primary', onclick: onContinue }, 'Continue ', el('kbd', {}, 'Enter')));
}

// ─── Labels ──────────────────────────────────────────────────────────────────

function stepName(step) {
  return `${step.mode} · ${step.label}`;
}

function progressLabel(progress) {
  if (isMastered(progress)) return 'Memorized ✓';
  return `Step ${progress.step + 1} of ${STEPS.length}: ${stepName(currentStep(progress))}`;
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
