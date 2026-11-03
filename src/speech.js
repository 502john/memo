/**
 * speech.js: answering out loud, using the browser's built-in Web Speech API.
 *
 * Chrome, Edge and Safari support it; Firefox doesn't, so the mic button is disabled there.
 * Chrome sends the audio to Google to be transcribed. Memo itself never stores or sends it.
 * Browsers end recognition after a pause, so it restarts itself until stopListening().
 *
 * Words fill in while you're still talking. The recognizer streams interim guesses
 * for each phrase; a word is passed to onWords as soon as another word follows it,
 * and the word still being said goes to onHearing as a live preview. The last word
 * of a phrase is passed on once the browser marks the phrase final. `passedOn`
 * counts, per phrase, how many words have already gone to onWords, so a guess that
 * grows ("the lord" → "the lord is") only sends the new words.
 */

const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

export const isSpeechSupported = Boolean(Recognition);

let active = null;

export function startListening({ onWords, onHearing, onBlocked }) {
  const recognition = new Recognition();
  active = recognition;
  recognition.continuous = true;
  recognition.interimResults = true;
  let passedOn = [];

  recognition.onresult = (event) => {
    if (active !== recognition) return;
    let hearing = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const words = result[0].transcript.trim().split(/\s+/).filter(Boolean);
      const settled = result.isFinal ? words : words.slice(0, -1);
      const sent = passedOn[i] ?? 0;
      if (settled.length > sent) onWords(settled.slice(sent));
      passedOn[i] = Math.max(sent, settled.length);
      if (!result.isFinal) hearing = words.at(-1) ?? '';
    }
    onHearing(hearing);
  };

  recognition.onerror = (event) => {
    if (event.error !== 'not-allowed' && event.error !== 'service-not-allowed') return;
    active = null;
    onBlocked();
  };

  recognition.onend = () => {
    if (active !== recognition) return;
    passedOn = [];
    recognition.start();
  };

  recognition.start();
}

export function stopListening() {
  const recognition = active;
  active = null;
  recognition?.stop();
}
