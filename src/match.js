/**
 * match.js: does a spoken word count as the word on the page?
 *
 * Speech recognizers mishear a lot ("Kirk" for "killed"), so a spoken word counts when it
 * merely starts the same way: the same first letter, or the same first sound. That's a
 * deliberate tradeoff, since a wrong word with the same start also passes. Typing stays strict.
 *
 * First sounds treat letters that sound alike as equal: hard c, k and q ("cat" / "kat"),
 * soft c and s ("cent" / "sent"), soft g and j ("gem" / "jem"), ph and f, x and z, and
 * silent starts ("knee" / "nee", "write" / "right", "psalm" / "salm"). Digits are compared
 * as the words they're said as ("4" starts like "four").
 */

const SPELLED_STARTS = [['kn', 'n'], ['gn', 'n'], ['pn', 'n'], ['mn', 'n'], ['wr', 'r'], ['ps', 's'], ['pt', 't'], ['ph', 'f']];

const SAME_SOUND = { q: 'k', x: 'z' };

const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'mm']);

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Both words are already toKey()'d: lowercase letters and digits only. */
export function startsLike(heard, target) {
  const [said, word] = [spelledOut(heard), spelledOut(target)];
  return said[0] === word[0] || firstSound(said) === firstSound(word);
}

/** "400" for "four hundred": the heard word, spelled out, is exactly these words run together. */
export function spellsOut(heard, targets) {
  return spelledOut(heard) === targets.map(spelledOut).join('');
}

export function isFiller(heard) {
  return FILLERS.has(heard);
}

function firstSound(word) {
  const spelledStart = SPELLED_STARTS.find(([start]) => word.startsWith(start));
  const letter = spelledStart ? spelledStart[1] : word[0];
  if (letter === 'c') return /^c[eiy]/.test(word) ? 's' : 'k';
  if (letter === 'g' && /^g[eiy]/.test(word)) return 'j';
  return SAME_SOUND[letter] ?? letter;
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
