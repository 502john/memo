/**
 * state.js: the memorization rules, written as pure functions (no DOM, no storage).
 *
 * LADDER: saved per passage as progress = { step, cleanRuns }
 *   1 Outline → 2 Recall 50% → 2 Recall 75% → 2 Recall 100% → 3 Full → mastered
 *   `reps` (1–5) is chosen when the passage is added and never changes.
 *   A run with no misses adds 1 to cleanRuns. Reaching `reps` moves up one step.
 *   A run with any miss resets cleanRuns to 0. Mastered means step === STEPS.length.
 *   Steps can't be skipped. Once mastered, any step can be picked for review,
 *   and the passage stays mastered.
 *
 * RUN: one pass through the text, TYPING ──last word──► FINISHED
 *   FIRST_LETTER (modes 1–2): one key per word. A wrong key marks the word MISSED and moves on.
 *   WHOLE_WORD   (mode 3):    every letter. A wrong letter is held in `wrongLetter` and blocks
 *                             until the right one is typed. The word then counts as MISSED (`stumbled`).
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

export function createPassage(title, text, reps) {
  return { id: crypto.randomUUID(), title, text, reps, progress: progressAt(0) };
}

export function replacePassage(passages, passage) {
  return passages.map((existing) => (existing.id === passage.id ? passage : existing));
}

/** Imported passages win over existing ones with the same id. */
export function mergePassages(existing, imported) {
  const importedIds = new Set(imported.map((passage) => passage.id));
  return [...existing.filter((passage) => !importedIds.has(passage.id)), ...imported];
}

export function progressAt(step) {
  return { step, cleanRuns: 0 };
}

export function isMastered(progress) {
  return progress.step >= STEPS.length;
}

/** Once mastered, you keep practising the last step. */
export function currentStep(progress) {
  return STEPS[Math.min(progress.step, STEPS.length - 1)];
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
    wrongLetter: '',
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

  if (letter !== target[run.typed.length]) return { ...run, wrongLetter: letter, stumbled: true };

  const typed = run.typed + letter;
  if (typed === target) return answerWord(run, !run.stumbled);
  return { ...run, typed, wrongLetter: '' };
}

export function scoreRun(progress, run, reps) {
  if (run.misses > 0) {
    return { result: RESULT.FAILED, progress: progressAt(progress.step) };
  }

  const cleanRuns = progress.cleanRuns + 1;
  if (cleanRuns < reps) {
    return { result: RESULT.CLEAN, progress: { ...progress, cleanRuns } };
  }

  const next = progressAt(Math.min(progress.step + 1, STEPS.length));
  return { result: isMastered(next) ? RESULT.MASTERED : RESULT.LEVEL_UP, progress: next };
}

function answerWord(run, isCorrect) {
  return skipUntypeableWords({
    ...run,
    words: withResult(run.words, run.cursor, isCorrect ? WORD.CORRECT : WORD.MISSED),
    cursor: run.cursor + 1,
    typed: '',
    wrongLetter: '',
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
