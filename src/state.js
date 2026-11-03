/**
 * state.js: the memorization rules, written as pure functions (no DOM, no storage).
 *
 * LADDER: saved per passage as progress = { step, cleanRuns, completed }
 *   1 Outline → 2 Recall 50% → 2 Recall 75% → 2 Recall 100% → 3 Full
 *   A run with no misses adds 1 to cleanRuns. Reaching the passage's `reps` (1–5, changeable
 *   any time) completes the step and moves up one. A run with any miss resets cleanRuns to 0.
 *   You can jump to any step, but only steps in `completed` were earned.
 *   Mastered means Full is in `completed`.
 *
 * RUN: one pass through the text, TYPING ──last word──► FINISHED
 *   FIRST_LETTER (modes 1–2): one key per word. A wrong key marks the word MISSED and moves on.
 *   WHOLE_WORD   (mode 3):    every letter. A wrong letter is held in `wrongInput` and blocks
 *                             until the right one is typed. The word then counts as MISSED (`stumbled`).
 *   Speaking answers a whole word at a time under the same rules: in modes 1–2 a misheard word
 *   is MISSED and skipped; in mode 3 it's held in `wrongInput` until it's said right.
 *   Spaces and punctuation never need typing. Words with no letters ("—") fill in automatically.
 *   `cursor` is the word being answered. `lastAnswered` drives the reveal animation.
 *   Hidden words are reshuffled every run, so you can't learn the pattern instead of the text.
 */

export const VIEW = { LIBRARY: 'library', PRACTICE: 'practice' };

export const INPUT = { FIRST_LETTER: 'first-letter', WHOLE_WORD: 'whole-word' };

export const RUN = { TYPING: 'typing', FINISHED: 'finished' };

export const WORD = { PENDING: 'pending', CORRECT: 'correct', MISSED: 'missed' };

export const RESULT = { FAILED: 'failed', CLEAN: 'clean', LEVEL_UP: 'level-up', MASTERED: 'mastered' };

const firstLetterStep = (mode, label, hiddenRatio, shown) => ({
  mode,
  label,
  hiddenRatio,
  input: INPUT.FIRST_LETTER,
  hint: `${shown} Type the first letter of each word.`,
});

export const STEPS = [
  firstLetterStep(1, 'Outline', 0, 'Every word is shown.'),
  firstLetterStep(2, 'Recall 50%', 0.5, 'Half the words are hidden.'),
  firstLetterStep(2, 'Recall 75%', 0.75, 'Most words are hidden.'),
  firstLetterStep(2, 'Recall 100%', 1, 'Every word is hidden.'),
  {
    mode: 3,
    label: 'Full',
    hiddenRatio: 1,
    input: INPUT.WHOLE_WORD,
    hint: 'Nothing is shown. Type every word in full. A wrong letter stays red until you fix it.',
  },
];

export const REPS_OPTIONS = [1, 2, 3, 4, 5];

export const DEFAULT_REPS = 3;

export const SAMPLE_PASSAGE = {
  title: 'Psalm 23 (opening)',
  text: [
    'The Lord is my shepherd; I shall not want.',
    'He maketh me to lie down in green pastures:',
    'he leadeth me beside the still waters.',
    'He restoreth my soul:',
    "he leadeth me in the paths of righteousness for his name's sake.",
  ].join('\n'),
};

const LAST_STEP = STEPS.length - 1;

export function createPassage(title, text, reps) {
  return { id: crypto.randomUUID(), title, text, reps, progress: newProgress() };
}

/**
 * Saved data and backup files can be corrupted or hand-edited, so every passage
 * loaded from them is rebuilt from known fields, and unusable ones are dropped.
 * Saves from before skipping existed have no `completed`: back then every step
 * below `step` was earned, and a step past the end meant mastered.
 */
export function restorePassages(saved) {
  return saved.map(restorePassage).filter(Boolean);
}

function restorePassage(saved) {
  const { id, title, text, reps } = saved ?? {};
  if (![id, title, text].every((field) => typeof field === 'string')) return null;

  const progress = saved.progress ?? {};
  const step = wholeNumberIn(progress.step, 0, STEPS.length);
  const completed = Array.isArray(progress.completed)
    ? progress.completed.filter((index) => Number.isInteger(index) && index >= 0 && index <= LAST_STEP)
    : Array.from({ length: step }, (_, i) => i);

  return {
    id,
    title,
    text,
    reps: REPS_OPTIONS.includes(reps) ? reps : DEFAULT_REPS,
    progress: {
      step: Math.min(step, LAST_STEP),
      cleanRuns: wholeNumberIn(progress.cleanRuns, 0, REPS_OPTIONS.at(-1)),
      completed: [...new Set(completed)],
    },
  };
}

function wholeNumberIn(value, min, max) {
  return Number.isInteger(value) ? Math.min(Math.max(value, min), max) : min;
}

export function replacePassage(passages, passage) {
  return passages.map((existing) => (existing.id === passage.id ? passage : existing));
}

/** Imported passages win over existing ones with the same id. */
export function mergePassages(existing, imported) {
  const importedIds = new Set(imported.map((passage) => passage.id));
  return [...existing.filter((passage) => !importedIds.has(passage.id)), ...imported];
}

export function newProgress() {
  return { step: 0, cleanRuns: 0, completed: [] };
}

export function moveToStep(progress, step) {
  return { ...progress, step, cleanRuns: 0 };
}

export function isMastered(progress) {
  return progress.completed.includes(LAST_STEP);
}

export function currentStep(progress) {
  return STEPS[progress.step];
}

/** The letters to type: "Shepherd;" → "shepherd", "Café" → "cafe", "—" → "". */
export function toKey(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Line breaks (up to 2) are kept on each word so poems and paragraphs keep their shape. */
export function parseWords(text) {
  const words = [];
  let lineBreaksBefore = 0;

  for (const chunk of text.trim().split(/(\s+)/)) {
    const isWhitespace = /^\s*$/.test(chunk);
    if (isWhitespace) {
      lineBreaksBefore = Math.min((chunk.match(/\n/g) ?? []).length, 2);
      continue;
    }
    words.push({ text: chunk, key: toKey(chunk), lineBreaksBefore });
    lineBreaksBefore = 0;
  }
  return words;
}

export function startRun(text, step) {
  const words = parseWords(text);
  const hidden = pickHiddenIndexes(words, step.hiddenRatio);

  return skipUntypeableWords({
    status: RUN.TYPING,
    step,
    words: words.map((word, i) => ({ ...word, hidden: hidden.has(i), result: WORD.PENDING })),
    cursor: 0,
    typed: '',
    wrongInput: '',
    stumbled: false,
    misses: 0,
    lastAnswered: null,
  });
}

export function typeKey(run, char) {
  if (run.status !== RUN.TYPING) return run;

  const letter = toKey(char);
  if (!letter) return run;

  const target = run.words[run.cursor].key;
  if (run.step.input === INPUT.FIRST_LETTER) return answerWord(run, letter === target[0]);

  if (letter !== target[run.typed.length]) return { ...run, wrongInput: letter, stumbled: true };

  const typed = run.typed + letter;
  if (typed === target) return answerWord(run, !run.stumbled);
  return { ...run, typed, wrongInput: '' };
}

export function sayWord(run, spoken) {
  if (run.status !== RUN.TYPING) return run;

  const heard = toKey(spoken);
  if (!heard) return run;

  const isCorrect = heard === run.words[run.cursor].key;
  if (isCorrect || run.step.input === INPUT.FIRST_LETTER) return answerWord(run, isCorrect && !run.stumbled);
  return { ...run, wrongInput: heard, stumbled: true };
}

export function scoreRun(progress, run, reps) {
  if (run.misses > 0) {
    return { result: RESULT.FAILED, progress: { ...progress, cleanRuns: 0 } };
  }

  const cleanRuns = progress.cleanRuns + 1;
  if (cleanRuns < reps) {
    return { result: RESULT.CLEAN, progress: { ...progress, cleanRuns } };
  }

  const completed = [...new Set([...progress.completed, progress.step])];
  if (progress.step === LAST_STEP) {
    return { result: RESULT.MASTERED, progress: { ...progress, cleanRuns: 0, completed } };
  }
  return { result: RESULT.LEVEL_UP, progress: { step: progress.step + 1, cleanRuns: 0, completed } };
}

function answerWord(run, isCorrect) {
  return skipUntypeableWords({
    ...run,
    words: withResult(run.words, run.cursor, isCorrect ? WORD.CORRECT : WORD.MISSED),
    cursor: run.cursor + 1,
    typed: '',
    wrongInput: '',
    stumbled: false,
    misses: run.misses + (isCorrect ? 0 : 1),
    lastAnswered: run.cursor,
  });
}

function skipUntypeableWords(run) {
  let { words, cursor } = run;
  while (cursor < words.length && !words[cursor].key) {
    words = withResult(words, cursor, WORD.CORRECT);
    cursor += 1;
  }
  const status = cursor < words.length ? RUN.TYPING : RUN.FINISHED;
  return { ...run, words, cursor, status };
}

function withResult(words, index, result) {
  return words.map((word, i) => (i === index ? { ...word, result } : word));
}

function pickHiddenIndexes(words, ratio) {
  const typeable = words.flatMap((word, i) => (word.key ? [i] : []));
  const count = Math.round(typeable.length * ratio);
  return new Set(shuffle(typeable).slice(0, count));
}

/** Fisher–Yates shuffle. */
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
