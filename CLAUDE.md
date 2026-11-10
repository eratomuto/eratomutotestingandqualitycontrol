# RUSH front end: rules for the coding agent

RUSH routes rural Nova Scotia specialist referrals (starting with cardiac/pacemaker) to the hospital that can safely see the patient soonest. Claude reads the note, a rules engine ranks hospitals, **the doctor makes the final call.** All hospital data is simulated.

Your job here is the front end: `index.html` only. The owner is Eeshan. The back-end (`app/`, `run.py`, `requirements.txt`) belongs to Palaash.

## Scope

- **Edit:** `index.html`, and `README.md` sections about using the website.
- **Do not edit:** anything in `app/`, `run.py`, `requirements.txt`. If the front end needs a back-end change, don't make it. Add one line to `docs/backend-requests.md` (what, why) and carry on with a front-end-only approach.
- **Keep it one file.** The server only serves `index.html` and `SH.png`, so splitting into CSS/JS files would need a back-end change. Organise inside the file with the existing `/* ===== section ===== */` headers.
- **Frozen blocks inside `index.html`** (they mirror the back-end so practice mode matches it; calling them is fine, editing them is not): `ZIPS`, `MOCK_HUBS`, `WEIGHTS`, `geodesicKm`, `capScore`, `scoreHub`, `pickSpecialist`, `estWait`, `route`, `mockTriage`, `mockApi`. If one looks wrong, report it in `docs/backend-requests.md`.

## How to work (read this twice)

**Do not test anything.** Don't write test files, don't start the server, don't open the page, don't run scripts to "check". Eeshan tests by hand. Your checking is reading your own diff once, top to bottom, before you hand off.

**Fix the class, not the case.** The failure to avoid is code that makes one example work while its siblings break. So:
- Before editing, write two lines: the general rule you are implementing, and three different inputs it must handle, one of which must *not* trigger it.
- Never branch on literal content: preset note text, the three example postal codes, specific hospital IDs, specific specialty names (the `TOWN` map is the one existing exception). Behaviour comes from state and data.
- Never edit `PRESETS` or sample data to make something look right.
- If a fix works by adding a special case, stop and find the general cause.

**Hand-off format.** End every task with exactly this:
1. *Changed:* up to 5 bullets.
2. *General rule:* the one-sentence rule you implemented.
3. *Shares code with:* other screens or functions that use the same code and could be affected.
4. *Please check:* 4 to 6 items, each one a *kind* of input (not one example) plus a control that should NOT change. Point to the matching section in Eeshan's test plan if it exists.
5. *Not done / unsure:* anything you skipped or guessed.

## Hard rules

1. **A human decides.** Nothing is sent unless the doctor presses the send button. No auto-send, no timers that send.
2. **Say when it's a guess.** Any urgency from keyword matching stays flagged and visible. Never hide, shrink or auto-dismiss that warning.
3. **Never show invented data.** If a value is unknown, say "unknown". Don't fill gaps with plausible numbers.
4. **Simulated stays labelled**, including on anything that leaves the screen (copy, print).
5. **Privacy.** Clinical notes never go into `localStorage`, the URL, `console.*`, or any third-party request. No new external scripts, fonts, analytics or CDNs.
6. **Doctors are busy.** One screen, one job, one big primary button. Don't add modals, pop-ups, toasts, tours or confirmation dialogs.
7. **Don't change what numbers mean.** Distances, waits, scores and weights shown on screen must be exactly what the frozen blocks compute.

## Writing and layout rules

These come from standard usability guidance (Nielsen's heuristics, GOV.UK and UK Parliament form guidance, WCAG 2.2, clinical alert-fatigue research).

- **Show only what this decision needs.** Everything else goes in the existing details drawer. Move information, don't delete it. A number should appear once on the main screen.
- **Max one warning visible at a time.** If several apply, show the one that changes the doctor's decision most. Too many low-value alerts get ignored.
- **Prevent the error first.** Constrain the input (picker, auto-format) before writing an error message.
- **Errors say what happened and what to do**, in plain words, using the label the user sees ("Postal code", "Doctor's notes"). One message per cause (empty vs wrong format). No error codes, no "oops", "invalid", "please", "sorry", "field". Technical detail goes to the console only.
- **Same word for the same thing.** Hospital, referral, urgency, specialist. Never hub, site, node, score-as-jargon.
- **Going back never erases what they typed.**
- **Targets at least 24x24 px** (WCAG 2.2 AA), prefer 44 px for buttons. **No text under 14 px.** Nothing that works only on hover or drag.
- **The sticky command bar must never cover the focused element.** Keep `scroll-padding-top` on `html` equal to the bar's height.
- Colour is never the only signal. Keep reduced-motion behaviour.
- Keep the voice short and direct, like the existing copy. Sentences under ~15 words.

## Build queue (one task per request, in this order; don't start the next unprompted)

**F1. Let the doctor correct the urgency and specialty.** Today the screen says "make sure 7/10 is right" but the only way to change it is to reword the notes. Add a small "Change" control on the review screen (urgency 1 to 10, specialty from the 8 known). Re-run the existing `route()`, update the pick, and send the corrected patient to `/refer` (the server already honours a pre-filled urgency and specialty). The receipt gets an "Urgency set by" row: AI, keyword guess, or doctor.

**F2. Unknown postal codes.** Real clinics rarely have one of the 13 known codes, and today anything else silently becomes "100 km, a guess". Replace the guess with a "Nearest town" picker built from `ZIPS`, writing that town's code into the field. Sending with an unresolved code is not allowed.

**F3. Label what leaves the screen.** Copy text and print view say "DEMO: simulated hospitals, not a real referral". The print stylesheet currently hides the footer, which is where that notice lives.

**F4. Plain-language errors.** Replace "The server said: X (error 500)" patterns with what happened and what to do. Cover: server unreachable, notes unreadable, no hospital offers the specialty, send failed.

**F5. Declutter the review screen.** The same figures (percent full, wait, drive) appear in the sub-line, the "why" line, the picker and the table. Keep them in the answer card and the details drawer. Merge "why" and "vs. Halifax" into one line. Judge the sticky bar's height at 1366x768 and phone width, and shrink it if it takes more than about a sixth of the screen.

**F6. Honest labels.** "Hospital capacity (live)" becomes "(simulated)". Check every label that claims more than the demo does.

**F7. Don't lose the receipt.** Ctrl+Enter must not trigger "Next patient" on the receipt screen. Keep Copy and Print reachable until the doctor deliberately moves on.

**F8. Keyboard and focus.** `scroll-padding-top` (see above), visible focus everywhere, logical tab order across the three steps, focus lands on the new screen's heading.

**F9. Waiting states.** Triage can take up to 35 s. After about 8 s say it is taking longer than usual, and offer Cancel that returns to the notes with everything still typed.

**F10 (low priority). Drop the Google Fonts request.** Use system fonts or a self-hosted file so the page makes no third-party requests.

## Back-end: hands off

Don't touch it. If Eeshan later asks for a back-end "tidy" it must be a separate PR, behaviour-identical (moving hospital data and the postal-code table into constants/modules, naming the weights, type hints, docstrings), with Palaash as reviewer. Never mix it with front-end work.

Known back-end issues, for Palaash, not for you to fix:
- Keyword fallback: "no chest pain" scores urgency 7; a heart-block pacemaker note scores 3; pregnancy routes to General Medicine; fallback returns fake symptoms (`mocked_symptom_1`) and the UI detects fallback by matching `mock*` text.
- Postal codes are exact-match only (`b3h2y9` or any other code silently becomes 100 km).
- `/simulate/update-capacity` is open, CORS allows `*`, `geopy` is unpinned.
- Hospital data and scoring exist twice (Python and the frozen JS blocks) and can drift.
- Triage extracts no procedure; scoring uses no real wait data or travel preference, though the pitch says it does.
