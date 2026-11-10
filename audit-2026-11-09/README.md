# Browser audit of the RUSH front end, 2026-11-09

Report-only audits of `index.html`: scripts, raw results and server logs. Nothing here changes the app.

## What was tested

| Audit | Repo commit | Branch |
|---|---|---|
| **Final audit** (22 checks, parts A to F) | `cd77de1` "Final pass: set the step 1 tagline" | `claude/loving-babbage-omwqvn` |
| **Earlier F8/F9 audit** (focus, bar clearance, slow Find/Send) | `489feb8` "F9 fix: lock step 2 while a send is in flight" | `claude/loving-babbage-omwqvn` |

Commits made after the final audit are **not** covered: `26969d3` (lock the API address, never browser-tested) and `7bf4e09` (docs only).

## How it was run

- Server started with `python3 run.py --no-browser` and **no API key**, so triage ran in **keyword mode** (results are repeatable). The `.env` file was never opened.
- Chromium and Playwright from the sandbox, at **1366x768** and **360x800** (D to F checks at 1366x768 only).
- **Synthetic notes only.** The notes are the app's three example buttons plus short made-up sentences typed by the scripts (for example "chest pain for two hours"). One privacy check uses the made-up marker `PRIVSENTINEL9QX7`. No real patient data was used.
- Where a check needed an AI-style result (symptoms, risks, medications) the `/triage` response was **stubbed** in the page. Real AI results were not tested.
- Hospital data is the app's simulated data. Practice mode was tested by loading the page from `localhost:5500` with `?api=http://localhost:1`.

## Files: final audit (commit `cd77de1`)

| File | What it is |
|---|---|
| `lib.js` | Shared helpers: open the page, reach step 2 or 3, Tab-walk, focus-ring and contrast measurement, tall-bar helper. |
| `lib2.js` | Final-audit helpers: fetch stubs and delays, practice-mode page, warnings snapshot, bar ratio, sentence splitter. |
| `a.js`, `anA.js` | Part A (layout, focus, tab order, text size, 360px). `anA.js` prints the summary from `a_raw.json`. |
| `b.js`, `b2.js` | Part B (slow Find, cancel, late answer, slow Send, locked controls). `b2.js` re-measured two cases; its output was printed, not saved. |
| `c.js` | Part C (send-failure box, Find errors, warnings, figures shown once). |
| `d.js` | Part D (unknown postal codes, `~` and "approximate", town labels). |
| `e.js` | Part E (urgency and specialty change panel, receipt rows, print and copy, practice and server receipts). |
| `f.js` | Part F (review vs receipt, practice vs server, shortcuts, privacy and hosts, wording). |
| `a_raw.json` ... `f_raw.json` | Raw results for parts A to F. |
| `server2.log` | Server startup output for the final audit (shows keyword mode). |

## Files: earlier audit (commit `489feb8`)

| File | What it is |
|---|---|
| `f8.js`, `an1.js`, `an2.js`, `an3.js` | F8 checks (tall bar, focus rings, tab order, focus after change, text size, 360px) and their summary scripts. |
| `f9.js`, `fast.js` | F9 checks (slow Find/Send, cancel, locked controls, 500, fast paths). |
| `tbl.js` | Score-table scroll region against the command bar. |
| `smoke.js` | Page-opens and font check. |
| `f8_raw.json`, `f9_raw.json` | Raw results. |
| `server.log` | Server startup output for that audit. |

## Running the scripts again

Start the server in keyword mode, then run a script with Node from this folder:

```bash
env -u ANTHROPIC_API_KEY python3 run.py --no-browser
```

```bash
node a.js
```

Scripts expect the page at `http://localhost:8000` (UI also at `http://localhost:5500`) and a Playwright install that `require('playwright')` can find. `index.html` here may be a different version from the one audited, so numbers can differ.

## Limits

- No pixel or screenshot checks and no screen reader. Contrast is computed from CSS colours.
- Key repeat was simulated with Playwright key presses, and the 12 s delays and aborts were simulated in the page.
- The sandbox's own system font was used (Google Fonts had been removed), so line wrapping on another machine may differ.
- The Send-time postal-code guard cannot be reached from the UI, so it was not exercised.

## Left out on purpose

`.env`, `venv/`, `__pycache__/` and `node_modules/` (none were in the scratchpad), and the two copies of `index.html` used for a separate frozen-block comparison.
