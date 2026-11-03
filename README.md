# Memo

Memorize any text by typing it. No account, no server: everything stays in your browser.

## How it works

Each passage climbs a ladder. Each step needs a number of clean runs in a row (1–5, default 3), which you can change any time. Any miss means the run doesn't count. You can jump to any step. Only steps you actually complete get a ✓, and finishing Full marks the passage memorized.

| Mode | Step | What you see | What you type |
| --- | --- | --- | --- |
| 1 | Outline | every word | first letter of each word |
| 2 | Recall 50% → 75% → 100% | fewer and fewer words | first letter of each word |
| 3 | Full | nothing | every word in full |

In modes 1–2 a wrong key marks the word as missed and moves on. In mode 3 a wrong letter stays red until you type the right one. Case, spaces and punctuation never matter.

**Speak instead of type:** press **speak** and say each word. Speech recognizers often mishear right answers, so speaking is forgiving: sound-alikes ("two" for "to"), numbers ("23" / "twenty three"), near spellings, words heard in pieces ("a costa" for "Acosta") and dropped small words all count (see `src/match.js`). A word that's really wrong is still a miss. This uses the browser's built-in speech recognition (Chrome, Edge, Safari; not Firefox); see Privacy for where the audio goes.

**Read aloud first:** before testing yourself, use **Read aloud** on a passage as a warm-up. Say it out loud while the screen shows less each time: the full text, then each word's first letter, then only the first word of each line. Nothing is checked. Move on with **Next**, `ctrl/cmd + enter` or `→`.

**Also:**
- Word count and speaking time for each passage.
- Three text sizes, a light/dark/system theme switch, and fullscreen (`f`).
- Works offline after the first visit, and can be installed as an app.

## Run locally

The app uses ES modules, so it needs a local server. Opening the file directly won't work.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (free)

GitHub → **Settings → Pages → Deploy from a branch → `main` / root**. Every push to `main` goes live.

## Code map

| File | Role |
| --- | --- |
| `src/state.js` | The rules: ladder, runs, scoring. Pure functions, no DOM. |
| `src/components.js` | UI as function components: `props → DOM element`. |
| `src/app.js` | The single `state` object, the actions that change it, and `render`. |
| `src/match.js` | Whether a spoken word counts as the word on the page. |
| `src/speech.js` | Speech input through the browser's Web Speech API. |
| `sw.js` | Service worker that caches the app so it works offline. |
| `src/storage.js` | localStorage, plus export and import of backups. |
| `src/dom.js` | `el()`, the helper every component is built with. |

## Privacy

Memo has no server and collects nothing. Passages and progress are stored in your browser's localStorage, and the font is served from this site, so a visit makes no third-party requests. The one exception is **speak**: your browser's speech recognition handles the audio. Where the browser can transcribe on the device (recent Chrome, after a one-time language download it starts in the background) the audio never leaves your computer; otherwise it's sent to the browser's speech service, which is Google in Chrome. The page says which one is in use while it's listening.

## Credits

- The look follows [Monkeytype](https://github.com/monkeytypegame/monkeytype)'s "serika" themes. Only colours and layout ideas are borrowed, no code.
- [Roboto Mono](https://github.com/googlefonts/robotomono) is used under the SIL Open Font License (`fonts/OFL.txt`).
- The sample passage is Psalm 23 from the King James Version, which is public domain in the US.

## License

MIT
