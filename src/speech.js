/**
 * speech.js: answering out loud, using the browser's built-in Web Speech API.
 *
 * Chrome, Edge and Safari support it; Firefox doesn't, so the mic button is disabled there.
 * Where the browser can transcribe on the device it does, which is faster and keeps the
 * audio on the computer. Otherwise the audio goes to the browser's speech service (Google,
 * in Chrome). The first time, Memo asks the browser to download its on-device language
 * pack in the background and uses the online service meanwhile. onDevice(true|false)
 * reports which one is in use, and listening falls back to online if on-device fails.
 * Browsers end recognition after a pause, so it restarts itself until stopListening().
 *
 * Words fill in while you're still talking. The recognizer streams growing guesses for
 * each phrase. A word goes to onWords as soon as another word follows it, or straight
 * away when isExpected(word) says it's the word due next, so a right answer never waits.
 * The word still being said goes to onHearing as a live preview. `passedOn` counts, per
 * phrase, how many words have already gone to onWords, so each word is sent once.
 */

const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
const ON_DEVICE = { langs: [navigator.language || 'en-US'], processLocally: true };

export const isSpeechSupported = Boolean(Recognition);

let active = null;
let wanted = false;

async function canTranscribeOnDevice() {
  if (!Recognition.available) return false;
  const availability = await Recognition.available(ON_DEVICE).catch(() => 'unavailable');
  if (availability === 'downloadable') Recognition.install(ON_DEVICE).catch(() => {});
  return availability === 'available';
}

export async function startListening({ onWords, onHearing, isExpected, onDevice, onBlocked }) {
  wanted = true;
  const useDevice = await canTranscribeOnDevice();
  if (!wanted) return;

  const recognition = new Recognition();
  active = recognition;
  recognition.lang = ON_DEVICE.langs[0];
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.processLocally = useDevice;
  onDevice(useDevice);
  let passedOn = [];

  recognition.onresult = (event) => {
    if (active !== recognition) return;
    let hearing = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const words = result[0].transcript.trim().split(/\s+/).filter(Boolean);
      const settled = result.isFinal ? words.length : words.length - 1;
      const sent = passedOn[i] ?? 0;
      if (settled > sent) onWords(words.slice(sent, settled));
      passedOn[i] = Math.max(sent, settled);

      const last = words.at(-1);
      if (passedOn[i] < words.length && isExpected(last)) {
        onWords([last]);
        passedOn[i] = words.length;
      }
      if (passedOn[i] < words.length) hearing = last;
    }
    onHearing(hearing);
  };

  recognition.onerror = (event) => {
    if (event.error === 'language-not-supported' && recognition.processLocally) {
      recognition.processLocally = false;
      onDevice(false);
      return;
    }
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
  wanted = false;
  const recognition = active;
  active = null;
  recognition?.stop();
}
