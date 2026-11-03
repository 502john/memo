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

## License

MIT
