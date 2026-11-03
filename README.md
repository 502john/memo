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

**Speak instead of type:** press **speak** and say each word. The same rules apply: in modes 1–2 a misheard word is a miss, and in mode 3 it stays red until you say it right. This uses the browser's built-in speech recognition (Chrome, Edge, Safari; not Firefox). Chrome sends the audio to Google to transcribe it.

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
| `src/speech.js` | Speech input through the browser's Web Speech API. |
| `src/storage.js` | localStorage, plus export and import of backups. |
| `src/dom.js` | `el()`, the helper every component is built with. |

## Privacy

Memo has no server and collects nothing. Passages and progress are stored in your browser's localStorage, and the font is served from this site, so a visit makes no third-party requests. The one exception is **speak**: your browser's speech recognition handles the audio, and in Chrome that means it's sent to Google to be transcribed.

## Credits

- The look follows [Monkeytype](https://github.com/monkeytypegame/monkeytype)'s "serika" themes. Only colours and layout ideas are borrowed, no code.
- [Roboto Mono](https://github.com/googlefonts/robotomono) is used under the SIL Open Font License (`fonts/OFL.txt`).
- The sample passage is Psalm 23 from the King James Version, which is public domain in the US.

## License

MIT
