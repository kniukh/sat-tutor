# Reading and Vocabulary Full QA — 2026-07-30

## Scope

- Test student: `test2`
- Environment: local application with connected Supabase
- Reading lesson: `Chapter 1 — Chapter 1 — Part 1`
- Mobile Vocabulary viewport: 390 × 844
- Progress mutations were allowed because the student is a QA account.

## Reading Lesson

Passed:

- Student login and authenticated lesson access.
- Dashboard, book path, and lesson rendering.
- `first_read → vocab_review → second_read → questions`.
- Attempting to skip the second read is rejected with `409`.
- Invalid question or option input is rejected with `400`.
- One deliberately incorrect answer followed by Repair credit.
- Repair endpoint returned `200`.
- Four question answers persisted with server-derived skill values.
- Lesson completion returned `200`.
- Repeated completion remained idempotent and created only one attempt.
- Completed lessons cannot regress to an earlier stage.
- Completion time after the fixes: approximately 1.6 seconds.
- Unauthenticated student and admin mutations returned `401`.

Fixes made:

- Repair feedback now appears immediately. XP credit saves in the background instead
  of blocking the `Fixed` state.
- Book progress and completion XP are processed in parallel.
- Quiz results now have one `Finish Lesson` action that completes the lesson and
  goes directly to the dashboard.

## Vocabulary Drills

Passed in the interactive mobile journey:

- Fill Blank.
- Full-sentence Collocation.
- Context Meaning.
- Spelling from Audio with typed input.
- Listen Match.
- Correct feedback.
- Incorrect feedback with correct answer and explanation.
- Corrective reinforcement exercises.
- Dynamic queue growth after mistakes.
- Attempt persistence.
- Checkpoint finalization.
- XP, accuracy, combo, and continuation actions rendered after saving.

The final journey completed nine exercise screens, including reinforcement, and
reached a saved checkpoint. Before the fix, the same scenario remained on
`Saving your checkpoint…` for more than 20 seconds.

Root cause and fix:

- The completion handler waited for pending attempt writes and then submitted
  the complete result set a second time.
- The duplicate reconciliation pass was removed. Attempt writes remain
  idempotent, pending writes are awaited once, and the server-side finalizer
  already retries a short attempt-save race.

## Performance

- Dashboard: approximately 1.2 seconds.
- Book path: approximately 1.1 seconds.
- Reading lesson: approximately 1.3 seconds in the final run.
- Reading completion: approximately 1.6 seconds.
- Vocabulary list pages: under approximately 1.4 seconds.
- Vocabulary focused-session cold loading was optimized after the initial audit:
  `learn_new_words` dropped from approximately 11.1 seconds to 5.7 seconds,
  while the response payload dropped from approximately 511 KB to 226 KB.
- `review_weak_words` measured approximately 4.7 seconds and
  `mixed_practice` approximately 3.1 seconds in the same regression run.

Recommendation:

- Pre-build or cache the next ready session when a lesson finishes if a
  sub-three-second cold start becomes a product requirement.

## Ukrainian Language

Added `uk` / Ukrainian to:

- Create Student.
- Edit Student.
- Student create and update API validation.
- Inline vocabulary preview generation.
- Vocabulary explanation generation.

New vocabulary content for Ukrainian students will request Ukrainian
translations rather than falling back to Russian.
