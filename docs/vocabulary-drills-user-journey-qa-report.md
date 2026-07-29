# Vocabulary Drills — Interactive User Journey QA

Date: 2026-07-29  
Environment: local Next.js development server  
Viewport: 390 × 844  
Student: `test2`  
Mode: Mixed Practice  
Test type: real browser interaction with persisted attempts

## Executive summary

Result: **fail — two P0 persistence defects**.

The exercise player itself is usable and visually strong. Option selection, adaptive retry insertion, audio matching, attempt verification, final checkpoint, and XP display all worked through real browser clicks.

However, the complete user journey is not reliable enough for production:

1. A supposedly new drill can reuse an earlier `session_id`, combining attempts from separate launches.
2. The completion screen says `Checkpoint saved` before asynchronous attempt and session finalization is complete. Leaving quickly can abort finalization while the UI still claims success.

The final controlled UI journey showed 50% accuracy, but the persisted reused session was finalized at 25% because the server counted attempts accumulated during earlier launches.

## Method

The audit used Chrome in headless mobile mode with a real signed student session. It interacted with visible buttons rather than directly inserting database rows.

Actions performed:

- opened Mixed Practice;
- selected correct and incorrect multiple-choice answers;
- submitted answers;
- observed dynamically inserted retry exercises;
- completed all six pairs in an audio matching exercise;
- clicked Finish;
- inspected the checkpoint immediately;
- waited ten seconds and inspected it again;
- queried `exercise_attempts`, `vocab_sessions`, and `word_progress`.

This audit intentionally changed the test student's vocabulary history.

Artifacts:

- `test-results/ui-ux-audit/vocabulary-drill-journey.json`
- `test-results/ui-ux-audit/vocabulary-drill-feedback-*.png`
- `test-results/ui-ux-audit/vocabulary-drill-completion.png`
- `test-results/ui-ux-audit/vocabulary-drill-db-before.json`
- `test-results/ui-ux-audit/vocabulary-drill-db-after.json`

## Final controlled journey

| Step | Exercise | User action | Actual result |
| --- | --- | --- | --- |
| 1 | Definition of `good-naturedly` | Correct answer | Advanced to exercise 2 |
| 2 | Meaning in context | Incorrect answer | Advanced immediately; total changed from 3 to 4 |
| 3 | Match six audio clips to English words | All six correct pairs | Continue became enabled; attempt saved correctly |
| 4 | Definition retry | Incorrect answer | Checkpoint opened |
| Completion | Checkpoint | Waited for finalization | UI showed 50% and XP changed from +2 to +10 |

The displayed 50% is correct for this four-exercise journey: two correct and two incorrect.

## What worked

### Exercise presentation

- One exercise is presented at a time.
- Options are large and fit the mobile viewport.
- Continue is disabled until the response is complete.
- Finish appears on the last exercise.
- No horizontal overflow occurred.
- The bottom action area remained visible.

### Server verification

Persisted attempts contained:

- server-resolved exercise type;
- verified `is_correct`;
- selected option IDs;
- correct option IDs;
- response time;
- session mode;
- adaptive review metadata.

Forging a correct result on the client is not sufficient because the server recalculates correctness from the registered exercise snapshot.

### Adaptive retry

An incorrect answer added a simpler follow-up exercise for the same word:

- initial total: 3 exercises;
- after first error: 4 exercises;
- on repeated errors, the route moved the word into a recent-failure/supportive path.

The adaptation was pedagogically reasonable: definition → context → audio → retry.

### Audio matching

- Six audio tiles and six English-word tiles rendered correctly.
- Selecting a correct pair produced a short positive state.
- Matched pairs became disabled.
- Continue was enabled only after all six pairs were completed.
- The server saved the `listen_match` attempt as correct.

### Completion design

The checkpoint screen clearly displayed:

- accuracy;
- XP;
- maximum combo;
- words improved;
- Continue Practice;
- Review Weak Words;
- Back to vocabulary.

The final visual hierarchy is strong and already close to the desired learning-game direction.

## Findings

### P0 — Separate launches reuse the same vocabulary session ID

The session ID is deterministically generated from stable session inputs:

`vocab-session:${mode}:${hash(seed)}`

Opening a new drill with the same effective seed can reuse a previous database row instead of creating a new session instance.

Observed:

- session `vocab-session:mixed_practice:1ebz0as` accumulated 12 attempts across multiple browser launches;
- the final controlled UI journey contained only four exercises;
- UI accuracy: 50%;
- persisted/finalized accuracy: 25%;
- the completion reward used the combined server attempt history.

Impact:

- incorrect accuracy;
- incorrect XP;
- polluted session analytics;
- inflated exercise count;
- unrelated launches can affect mastery and streak calculations;
- a completed session can be accidentally reopened or overwritten.

Recommendation:

- generate a cryptographically unique session instance ID for every new launch, for example `crypto.randomUUID()`;
- keep deterministic IDs only for exercise content/cache identity;
- if session resume is required, store an explicit active-session reference and resume only when the user selects Resume;
- never update the exercise snapshot of a completed session;
- enforce a database rule preventing new attempts on completed sessions;
- calculate UI results from the same persisted attempt set used by the server.

Regression test:

1. Open Mixed Practice twice with identical vocabulary data.
2. Assert the two `session_id` values differ.
3. Complete both.
4. Assert each row has only its own attempts and accuracy.

### P0 — UI claims the checkpoint is saved before finalization succeeds

`VocabSessionPlayer.handleComplete()` immediately sets `done = true`, then saves pending attempts and calls `/api/vocabulary/session-complete` in a background transition.

Observed fast-exit scenario:

- checkpoint displayed `Checkpoint saved`;
- the browser was closed approximately one second later;
- the server logged `Unexpected end of JSON input` for `session-complete`;
- the relevant `vocab_sessions.completed_at` remained `null`;
- no completion reward metadata was stored.

When the page remained open for ten seconds:

- XP initially displayed `+2`;
- it later changed to `+10`;
- `completed_at` and `reward_credited_at` were finally stored.

Impact:

- user is told progress is saved when it is still pending;
- closing the tab, losing connection, or navigating away can leave an orphan session;
- XP can visibly change after the completion screen has already settled;
- failed finalization has no prominent retry state unless an attempt save itself fails.

Recommendation:

- show `Saving your checkpoint…` until all attempts and session completion succeed;
- disable navigation actions during the short finalization window;
- display `Checkpoint saved` only after the server response;
- on failure, show a persistent Retry saving button;
- store incomplete finalization intent locally and retry on next application load;
- optionally use a correctly formed `fetch(..., { keepalive: true })` for unload protection;
- do not rely on an empty `sendBeacon` request because the endpoint requires JSON;
- make completion idempotent by `student_id + session_id`.

### P1 — Wrong answers advance without educational feedback

After an incorrect multiple-choice answer:

- the next exercise appeared immediately;
- no visible `Incorrect` state remained;
- the correct choice was not identified;
- the explanation was not shown;
- the student was not told why the session length increased.

The adaptive retry exists, but the learning moment is hidden.

Recommendation:

- hold the current screen after submission;
- show Correct/Not quite;
- highlight the correct answer;
- show the stored concise explanation;
- explain `A quick retry was added`;
- require a second Continue action before advancing.

### P1 — Exercise total changes without explanation

The header changed from:

- `Exercise 1 of 3`

to:

- `Exercise 2 of 4`

and later could grow again after another error.

This can feel like a punishment or an endless session.

Recommendation:

- use a segmented progress bar where retry segments animate into place;
- show `1 reinforcement exercise added`;
- set a visible maximum, such as `3 core + up to 2 retries`;
- avoid decreasing apparent completion percentage without explanation.

### P1 — Session can over-focus on one word

Most of the journey tested `good-naturedly` repeatedly:

- definition;
- contextual meaning;
- audio matching including the word;
- definition retry.

Repetition is useful after an error, but the session becomes monotonous and the same distractors recur.

Recommendation:

- allow one immediate retry;
- insert at least one different word before a second retry;
- vary modality and sentence;
- cap same-word touches per checkpoint;
- clearly distinguish reinforcement from the main queue.

### P1 — Completion values are unstable while reward is pending

On the same checkpoint:

- XP first showed `+2`;
- approximately ten seconds later it showed `+10`.

Recommendation:

- render a skeleton or spinner while the authoritative XP value is pending;
- do not show a provisional number as final;
- animate from the confirmed previous XP to the confirmed reward only once.

### P2 — Standard answer cards lack an accessible selected state

DOM inspection found no `aria-pressed`, `aria-checked`, or selected data attribute on standard multiple-choice options. The selected state is communicated through CSS only.

Recommendation:

- wrap choices in a `radiogroup`;
- use `role="radio"` and `aria-checked`;
- preserve keyboard arrow navigation;
- announce correct/incorrect feedback through an `aria-live` region.

The audio matching component is better: it already exposes pressed states and labeled columns.

### P2 — Mixed-language feedback in audio matching

The prompt and English words are in English, while matched audio tiles reveal Russian translations. That can be useful, but the transition is not explained and differs from the requested “match audio to English word” task.

Recommendation:

- after a match, show the English word as the primary label;
- place the Russian translation underneath as optional reinforcement;
- keep language behavior consistent with the student's configured UI/translation language.

### P2 — Feedback and audio controls near the bottom are visually crowded

The completion screen includes several actions plus development/feedback controls near the safe area. In development, the Next indicator overlaps the lower content.

The Next indicator will not appear in production, but the real controls still need safe-area spacing.

Recommendation:

- add `padding-bottom: env(safe-area-inset-bottom)`;
- keep one primary completion action;
- move feedback settings into a menu;
- ensure the last text/control is not partially obscured.

## Data-side observations

After the test:

- attempts were persisted and server-verified;
- `good-naturedly` remained in `learning`;
- mastery stayed low after repeated incorrect answers;
- a future review time was scheduled;
- same-session mastery credit was capped, preventing rapid farming;
- several interrupted QA sessions remained incomplete because the UI was closed before finalization.

The mastery behavior is directionally correct. The unreliable session boundary is the main source of corrupted aggregate results.

## Recommended fix order

1. **P0:** unique session instance IDs and explicit resume semantics.
2. **P0:** wait for confirmed finalization before saying the checkpoint is saved.
3. **P1:** add persistent answer feedback and explanation before advancing.
4. **P1:** explain adaptive retry and cap session growth.
5. **P1:** diversify word order between retries.
6. **P2:** accessible radio semantics and live announcements.
7. **P2:** polish completion pending state, language behavior, and safe-area spacing.

## Production exit criteria

- Two fresh launches can never share a session row.
- UI and database accuracy are calculated from the same attempt IDs.
- Closing immediately after Finish does not lose finalization.
- The UI never says Saved before the server confirms it.
- Wrong answers show the correct answer and explanation.
- Adaptive retry changes are explained to the student.
- Every option exposes a programmatic selected state.
- Completion XP appears once and does not change silently.

## Remediation and regression result

Updated: 2026-07-29

All defects in this report were addressed:

- every launch now receives a UUID-based session instance ID;
- completed sessions reject snapshot reuse and new attempts;
- attempt payloads no longer resend the full exercise/audio object;
- retry exercise IDs are short and retain an explicit link to their source exercise;
- Finish reconciles the idempotent client attempt set before server finalization;
- the checkpoint stays in `Saving your checkpoint…` state with navigation disabled
  until attempts, authoritative XP, and completion metadata are confirmed;
- interrupted/failed saves expose a persistent retry action;
- incorrect answers remain visible with the selected answer, correct answer,
  explanation, and an explicit reinforcement notice;
- adaptive growth is capped to one generated retry per word and is shown in the
  progress header;
- audio matches reveal the English word first and the translation second;
- the completion action area includes safe-area padding.

The earlier accessibility finding was rechecked against the implementation:
standard answer cards already use `radiogroup`, `role="radio"`, `aria-checked`,
and arrow-key navigation. Feedback is now additionally announced through an
`aria-live` region. The original audit script inspected `aria-pressed` but not
`aria-checked`, so that specific finding was a test false positive.

Regression evidence:

- `npx tsc --noEmit`: pass;
- `npm run build`: pass (Next.js production build);
- interactive Chrome journey at 390 × 844: pass, including an incorrect answer,
  reinforcement insertion, six-pair audio matching, final retry, and checkpoint;
- fresh session persisted four isolated attempts and finalized with
  `completed_at` plus `reward_credited_at`;
- no client-side exception occurred during the final interactive run;
- route/authentication smoke checks returned 200/401/400 as expected. The strict
  10-second development-only performance threshold remains sensitive to Next.js
  cold compilation; warmed vocabulary-list routes remained below 1.3 seconds.
