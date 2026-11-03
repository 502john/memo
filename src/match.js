/**
 * match.js: does a spoken word count as the word on the page?
 *
 * Speech recognizers often hear a right answer wrongly, so speaking gets an allowance
 * that typing doesn't. Reading-assessment tools align the transcript word by word and
 * forgive near-misses in sound or spelling; this is a small version of that. Both
 * words are already toKey()'d (lowercase letters and digits only). A heard word counts when
 *
 *   SAME       it has the same letters ("Lord's" heard as "lords")
 *   NUMBER     it's the same number in digits or words ("4" / "four", "23" / "twenty three")
 *   HOMOPHONE  it's in a common sound-alike set ("to" / "two" / "too")
 *   CLOSE      it's a near spelling: about one wrong letter per four letters of the word.
 *              Words of 1–3 letters must be exact, or "on" would pass for "in".
 *
 * state.js sayWord adds the alignment rules on top: split words are joined back together
 * ("a costa" → "acosta"), one heard word may cover several ("400"), fillers are ignored,
 * and when the next word is heard the current one is treated as skipped.
 */

const HOMOPHONES = [
  ['to', 'two', 'too'], ['for', 'four', 'fore'], ['i', 'eye', 'aye'], ['by', 'buy', 'bye'],
  ['no', 'know'], ['new', 'knew'], ['there', 'their', 'theyre'], ['your', 'youre'],
  ['here', 'hear'], ['one', 'won'], ['be', 'bee'], ['see', 'sea'], ['right', 'write', 'rite'],
  ['our', 'hour'], ['whole', 'hole'], ['would', 'wood'], ['ate', 'eight'], ['so', 'sew', 'sow'],
  ['son', 'sun'], ['week', 'weak'], ['threw', 'through'], ['an', 'and'], ['or', 'oar', 'ore'],
];

const SOUND_ALIKE = new Map(HOMOPHONES.flatMap((set) => set.map((word) => [word, set])));

const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'mm']);

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function soundsLike(heard, target) {
  const [said, word] = [spelledOut(heard), spelledOut(target)];
  if (said === word) return true;
  if (SOUND_ALIKE.get(word)?.includes(said)) return true;
  return word.length >= 4 && editDistance(said, word) <= Math.floor(word.length / 4);
}

/** Whether `heard` could be the start of `target` split into pieces ("a" of "acosta", "twenty" of "23"). */
export function couldContinue(heard, target) {
  const [said, word] = [spelledOut(heard), spelledOut(target)];
  return said.length < word.length && word.startsWith(said);
}

export function isFiller(heard) {
  return FILLERS.has(heard);
}

/** "23" → "twentythree"; anything that isn't digits stays as it is. Up to 999,999. */
function spelledOut(key) {
  return /^\d+$/.test(key) && Number(key) < 1e6 ? numberWords(Number(key)) : key;
}

function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + 'hundred' + (n % 100 ? numberWords(n % 100) : '');
  return numberWords(Math.floor(n / 1000)) + 'thousand' + (n % 1000 ? numberWords(n % 1000) : '');
}

/** Levenshtein distance: the fewest single-letter inserts, deletes or swaps from a to b. */
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const swap = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, swap));
    }
    previous = current;
  }
  return previous[b.length];
}
