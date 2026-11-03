/**
 * components.js: the UI. Each component is a function that takes one props
 * object and returns a DOM element. Components never change state directly.
 * They call the callbacks (actions) they are given.
 *
 *   App
 *   ├── Toolbar
 *   ├── Library
 *   │   ├── BackupButtons
 *   │   ├── PassageCard (one per passage)
 *   │   └── PassageEditor → RepsPicker
 *   ├── ReadAloud
 *   └── Practice
 *       ├── settings bar: StepLadder, RepsPicker, MicButton
 *       ├── StreakCount
 *       ├── RunText → Word (one per word)
 *       └── RunSummary
 */

import { el, classes } from './dom.js';
import { isSpeechSupported } from './speech.js';
import {
  VIEW, INPUT, RUN, WORD, RESULT, STEPS, REPS_OPTIONS, DEFAULT_REPS, READ_VIEWS, TEXT_SIZES,
  currentStep, isMastered, wordCount, speakingSeconds,
} from './state.js';

const VIEWS = {
  [VIEW.LIBRARY]: Library,
  [VIEW.PRACTICE]: Practice,
  [VIEW.READ]: ReadAloud,
};

export function App({ state, actions }) {
  return el('div', { class: 'app' },
    el('header', { class: 'top' },
      el('h1', { class: 'brand' }, 'memo'),
      el('span', { class: 'muted' }, 'memorize anything by typing or saying it'),
      Toolbar({ settings: state.settings, fullscreen: state.fullscreen, actions })),
    VIEWS[state.view]({ state, actions }));
}

/** Text size, theme and fullscreen. The fullscreen button is left out where the browser can't do it. */
function Toolbar({ settings, fullscreen, actions }) {
  return el('div', { class: 'toolbar' },
    TEXT_SIZES.map((size) => el('button', {
      type: 'button',
      class: classes('quiet', `size-${size}`, settings.textSize === size && 'active'),
      'aria-label': `${size} text`,
      onclick: () => actions.setTextSize(size),
    }, 'A')),
    el('button', { type: 'button', class: 'quiet', onclick: actions.cycleTheme }, `theme: ${settings.theme}`),
    fullscreen !== null && el('button', { type: 'button', class: 'quiet', onclick: actions.toggleFullscreen },
      fullscreen ? 'exit fullscreen' : 'fullscreen'));
}

function Library({ state, actions }) {
  const editing = state.passages.find((passage) => passage.id === state.editingId);

  return el('section', { class: 'library' },
    el('div', { class: 'section-head' },
      el('h2', {}, 'Your passages'),
      BackupButtons({ onExport: actions.exportBackup, onImport: actions.importBackup })),
    el('ul', { class: 'passages' },
      state.passages.map((passage) => PassageCard({
        passage,
        onOpen: () => actions.openPassage(passage.id),
        onRead: () => actions.openReadAloud(passage.id),
        onEdit: () => actions.editPassage(passage.id),
        onDelete: () => actions.deletePassage(passage.id),
      }))),
    PassageEditor({ passage: editing, onSave: actions.savePassage, onCancel: actions.cancelEdit }),
    el('p', { class: 'note' },
      'Memo has no server and collects nothing: your passages stay in this browser. Use Export to back up or move to another device.'));
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

function PassageCard({ passage, onOpen, onRead, onEdit, onDelete }) {
  return el('li', { class: 'passage-row' },
    el('button', { type: 'button', class: 'passage-open', onclick: onOpen },
      el('span', { class: 'passage-name' },
        el('strong', {}, passage.title),
        el('span', { class: 'note' }, lengthLabel(passage.text))),
      el('span', { class: 'muted' }, progressLabel(passage.progress))),
    el('button', { type: 'button', class: 'quiet', onclick: onRead }, 'Read aloud'),
    el('button', { type: 'button', class: 'quiet', onclick: onEdit }, 'Edit'),
    el('button', { type: 'button', class: 'quiet danger', onclick: onDelete }, 'Delete'));
}

/**
 * Add a passage when `passage` is undefined, otherwise edit it. The fields aren't
 * kept in state, so the word count under the text box updates itself as you type.
 */
function PassageEditor({ passage, onSave, onCancel }) {
  const isEditing = Boolean(passage);
  const counter = el('span', { class: 'note' }, lengthLabel(passage?.text ?? ''));

  function submit(event) {
    event.preventDefault();
    const { title, text, reps } = event.target.elements;
    onSave({ title: title.value.trim(), text: text.value.trim(), reps: Number(reps.value) });
  }

  return el('form', { class: 'editor', onsubmit: submit },
    el('h3', {}, isEditing ? `Edit “${passage.title}”` : 'Add a passage'),
    el('input', { name: 'title', placeholder: 'Title, e.g. Psalm 23', required: true, value: passage?.title }),
    el('textarea', {
      name: 'text',
      rows: 6,
      placeholder: 'Paste the text you want to memorize. Keep its line breaks.',
      required: true,
      oninput: (event) => { counter.textContent = lengthLabel(event.target.value); },
    }, passage?.text),
    counter,
    RepsPicker({ reps: passage?.reps ?? DEFAULT_REPS }),
    isEditing && el('p', { class: 'note' }, "Changing the text resets this passage's progress."),
    el('div', { class: 'row' },
      el('button', { type: 'submit', class: 'primary' }, isEditing ? 'Save changes' : 'Add passage'),
      isEditing && el('button', { type: 'button', onclick: onCancel }, 'Cancel')));
}

/**
 * Inside the editor form it's read on submit; in Practice's settings bar, `onChange`
 * applies it right away and the shorter `label` keeps the bar on one line.
 */
function RepsPicker({ reps, onChange, label = 'Clean runs per step' }) {
  return el('label', { class: 'reps', title: 'Clean runs in a row needed to finish a step' }, `${label} `,
    el('select', { name: 'reps', onchange: onChange && ((event) => onChange(Number(event.target.value))) },
      REPS_OPTIONS.map((option) => el('option', { value: option, selected: option === reps }, option))));
}

/**
 * Read aloud: an unchecked warm-up. Each view shows less of the passage, and the
 * last step is a finish screen that hands over to Practice.
 */
function ReadAloud({ state, actions }) {
  const passage = state.passages.find((passage) => passage.id === state.activeId);
  const view = READ_VIEWS[state.readStep];

  return el('section', { class: 'read' },
    el('div', { class: 'section-head' },
      el('h2', {}, passage.title),
      el('button', { type: 'button', onclick: actions.goToLibrary }, 'All passages')),
    el('nav', { class: 'bar ladder', 'aria-label': 'Read aloud steps' },
      READ_VIEWS.map((step, i) => el('button', {
        type: 'button',
        class: classes('rung', i === state.readStep && 'active'),
        onclick: () => actions.goToReadStep(i),
      }, step.label))),
    el('div', { class: 'meta' },
      el('span', { class: 'muted' }, view ? view.hint : 'Now say it once more without looking.'),
      el('span', { class: 'note' }, lengthLabel(passage.text))),
    view
      ? el('p', { class: 'read-text' }, passage.text.split('\n').map(view.shows).join('\n'))
      : el('p', { class: 'read-done' }, 'Done. When you can say it from memory, test yourself in Practice.'),
    el('div', { class: 'row' },
      el('button', { type: 'button', onclick: () => actions.goToReadStep(state.readStep - 1), disabled: state.readStep === 0 }, 'Back'),
      view
        ? el('button', { type: 'button', class: 'primary', onclick: () => actions.goToReadStep(state.readStep + 1) }, 'Next')
        : [
          el('button', { type: 'button', onclick: () => actions.goToReadStep(0) }, 'Start over'),
          el('button', { type: 'button', class: 'primary', onclick: () => actions.openPassage(passage.id) }, 'Practice'),
        ],
      el('span', { class: 'note' }, el('kbd', {}, 'ctrl/cmd'), ' ', el('kbd', {}, 'enter'), ' next  ', el('kbd', {}, 'esc'), ' back to your passages')));
}

function Practice({ state, actions }) {
  const passage = state.passages.find((passage) => passage.id === state.activeId);
  const { progress, reps } = passage;
  const justCompletedStep = [RESULT.LEVEL_UP, RESULT.MASTERED].includes(state.lastResult);

  const refocusUnlessPicking = (event) => event.target.tagName !== 'SELECT' && actions.focusKeyboard();

  return el('section', { class: 'practice', onclick: refocusUnlessPicking },
    el('div', { class: 'section-head' },
      el('h2', {}, passage.title),
      el('button', { type: 'button', onclick: actions.goToLibrary }, 'All passages')),
    el('div', { class: 'bar' },
      StepLadder({ progress, activeStep: state.run.step, onPick: actions.goToStep }),
      el('span', { class: 'bar-divider', 'aria-hidden': 'true' }),
      RepsPicker({ reps, onChange: actions.setReps, label: 'reps' }),
      MicButton({ isListening: state.listening, onToggle: actions.toggleListening })),
    el('div', { class: 'meta' },
      StreakCount({ cleanRuns: justCompletedStep ? reps : progress.cleanRuns, reps }),
      el('span', { class: 'muted' }, state.listening ? ListeningHint({ onDevice: state.speechOnDevice }) : state.run.step.hint)),
    el('div', { class: 'text-box' }, RunText({ run: state.run, heard: state.heard })),
    state.run.status === RUN.FINISHED && RunSummary({
      result: state.lastResult,
      run: state.run,
      progress,
      reps,
      onContinue: actions.continueAfterRun,
    }),
    el('p', { class: 'note' }, el('kbd', {}, 'esc'), ' back to your passages',
      !isSpeechSupported && '. Speaking needs Chrome, Edge or Safari.'));
}

/** Any step can be picked; only steps actually completed get a tick. */
function StepLadder({ progress, activeStep, onPick }) {
  return el('nav', { class: 'ladder', 'aria-label': 'Steps' },
    STEPS.map((step, i) => el('button', {
      type: 'button',
      class: classes('rung', step === activeStep && 'active'),
      onclick: () => onPick(i),
    }, step.label, progress.completed.includes(i) && el('span', { class: 'tick', 'aria-label': 'completed' }, '✓'))));
}

/**
 * Shown even where speech isn't supported (Firefox), disabled, so people know the
 * option exists; Practice's footer note says which browsers support it.
 */
function MicButton({ isListening, onToggle }) {
  if (!isSpeechSupported) {
    return el('button', { type: 'button', class: 'mic', disabled: true, title: 'Needs Chrome, Edge or Safari' }, 'speak');
  }
  return el('button', {
    type: 'button',
    class: classes('mic', isListening && 'listening'),
    'aria-pressed': String(isListening),
    onclick: onToggle,
  }, isListening ? 'stop listening' : 'speak');
}

function ListeningHint({ onDevice }) {
  return onDevice
    ? 'Listening… say each word. Speech is transcribed on this device.'
    : "Listening… say each word. Your browser sends the audio to its speech service (Google, in Chrome) to transcribe it.";
}

function StreakCount({ cleanRuns, reps }) {
  return el('span', { class: 'streak', title: `${cleanRuns} of ${reps} clean runs in a row` }, `${cleanRuns}/${reps}`);
}

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

function RunText({ run, heard }) {
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
          wrongInput: run.wrongInput,
          heard: i === run.cursor ? heard : '',
          isCurrent: i === run.cursor,
          justAnswered: i === run.lastAnswered,
        }),
        ' ',
      ];
    }));
}

/** While speaking, `heard` previews the word the mic is still hearing in place of the usual content. */
function Word({ word, look, typed, wrongInput, heard, isCurrent, justAnswered }) {
  const content = heard || ({
    [LOOK.TYPING]: [typed, wrongInput && el('span', { class: 'wrong-input' }, wrongInput)],
    [LOOK.BLANK]: '',
  }[look] ?? word.text);

  return el('span', {
    class: classes('word', look, isCurrent && 'current', heard && 'hearing', justAnswered && 'reveal'),
    style: `--letters: ${word.text.length}`,
  }, content);
}

function LineBreaks({ count }) {
  return Array.from({ length: count }, () => el('br'));
}

/** Mastering a passage ends practice: confetti, then "Done" returns to the library. */
const SUMMARY = {
  [RESULT.FAILED]: {
    message: ({ run }) => `${plural(run.misses, 'word')} missed. This run doesn't count and your streak resets.`,
    button: 'Try again',
  },
  [RESULT.CLEAN]: {
    message: ({ progress, reps }) => `Clean run! ${progress.cleanRuns} of ${reps}.`,
    button: 'Next run',
  },
  [RESULT.LEVEL_UP]: {
    message: ({ progress }) => `Step complete! Next: ${currentStep(progress).label}.`,
    button: 'Next step',
  },
  [RESULT.MASTERED]: {
    message: () => 'Memorized! You recalled the whole thing from memory.',
    button: 'Done',
  },
};

function RunSummary({ result, run, progress, reps, onContinue }) {
  const { message, button } = SUMMARY[result];

  return el('div', { class: classes('summary', result), role: 'status' },
    result === RESULT.MASTERED && Confetti({ pieces: 120 }),
    el('p', {}, message({ run, progress, reps })),
    el('button', { type: 'button', class: 'primary', onclick: onContinue }, `${button} `, el('kbd', {}, 'Enter')));
}

const CONFETTI_COLORS = ['var(--main)', 'var(--text)', 'var(--sub)', 'var(--error)'];

/** Each piece gets a random column, drift, spin and delay; style.css makes it fall. */
function Confetti({ pieces }) {
  const random = (min, max) => min + Math.random() * (max - min);

  return el('div', { class: 'confetti', 'aria-hidden': 'true' },
    Array.from({ length: pieces }, (_, i) => el('span', {
      style: [
        `--x: ${random(0, 100)}vw`,
        `--drift: ${random(-15, 15)}vw`,
        `--spin: ${random(-3, 3)}turn`,
        `--delay: ${random(0, 0.8)}s`,
        `--color: ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`,
      ].join('; '),
    })));
}

function progressLabel(progress) {
  if (isMastered(progress)) return 'Memorized ✓';
  return `${currentStep(progress).label}, step ${progress.step + 1} of ${STEPS.length}`;
}

/** "41 words, about 20 seconds to say" */
function lengthLabel(text) {
  const seconds = speakingSeconds(text);
  const duration = seconds < 60 ? `${Math.max(5, Math.round(seconds / 5) * 5)} seconds` : `${Math.round(seconds / 60)} min`;
  return `${plural(wordCount(text), 'word')}, about ${duration} to say`;
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
