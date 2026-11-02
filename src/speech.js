/**
 * speech.js: answering out loud, using the browser's built-in Web Speech API.
 *
 * Chrome, Edge and Safari support it; Firefox doesn't, so the mic button is hidden there.
 * Chrome sends the audio to Google to be transcribed. Memo itself never stores or sends it.
 * Browsers end recognition after a pause, so it restarts itself until stopListening().
 */

const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

export const isSpeechSupported = Boolean(Recognition);

let active = null;

export function startListening({ onWords, onBlocked }) {
  const recognition = new Recognition();
  active = recognition;
  recognition.continuous = true;

  recognition.onresult = (event) => {
    if (active !== recognition) return;
    const finished = [...event.results].slice(event.resultIndex).filter((result) => result.isFinal);
    for (const result of finished) onWords(result[0].transcript.trim().split(/\s+/));
  };

  recognition.onerror = (event) => {
    if (event.error !== 'not-allowed' && event.error !== 'service-not-allowed') return;
    active = null;
    onBlocked();
  };

  recognition.onend = () => {
    if (active === recognition) recognition.start();
  };

  recognition.start();
}

export function stopListening() {
  const recognition = active;
  active = null;
  recognition?.stop();
}
