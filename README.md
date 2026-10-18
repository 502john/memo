# Memo

Memorize any text by typing it. No account, no server: everything stays in your browser.

## How it works

Each passage climbs a ladder. When you add a passage you choose how many clean runs in a row each step needs (1–5, default 3). That number can't be changed later. Any miss means the run doesn't count. You can't skip steps. Once a passage is memorized, every step unlocks for review.

| Mode | Step | What you see | What you type |
| --- | --- | --- | --- |
| 1 | Outline | every word | first letter of each word |
| 2 | Recall 50% → 75% → 100% | fewer and fewer words | first letter of each word |
| 3 | Full | nothing | every word in full |

In modes 1–2 a wrong key marks the word as missed and moves on. In mode 3 a wrong letter stays red until you type the right one. Case, spaces and punctuation never matter.

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
| `src/storage.js` | localStorage, plus export and import of backups. |
| `src/dom.js` | `el()`, the helper every component is built with. |

## License

MIT
