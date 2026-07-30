# Pre-session UI/UX QA — Reading and Vocabulary

Date: 2026-07-30  
Primary viewport: 390 × 844 (student mobile)

## Outcome

Reading and Vocabulary core flows are ready for the first live student session. The production build, API smoke tests, responsive captures, and a complete interactive Vocabulary run passed.

## Fixed during this audit

- Rebuilt the audiobook controls after Play and Stop icons rendered as nearly invisible dots on mobile.
- Added an explicit Play/Pause control with a visible label and icon.
- Added 15-second rewind and forward controls.
- Added a seek bar, elapsed/total segment time, and retained playback speed selection.
- Increased the audio seek touch area.
- Removed duplicated lesson titles such as `Chapter 1 — Chapter 1 — Part 4` from the student lesson header.
- Increased compact brand and lesson back controls to 44 × 44 px touch targets.
- Added a focused audio-lesson capture case and optional `QA_UI_CASE` filter to the UI audit script.

## Reading Lesson checks

- Lesson page and book path: HTTP 200.
- Full lesson state flow passed: first read, vocabulary review, second read, quiz, repair, completion.
- Repair credit: HTTP 200.
- Duplicate completion remains idempotent: one lesson attempt created.
- Unauthorized completion: HTTP 401.
- Invalid question submission: HTTP 400.
- Completion response time during this run: approximately 1.3 seconds.
- Audiobook asset: HTTP 200, `audio/mpeg`, approximately 21 MB.
- Audio lesson mobile layout: no horizontal overflow.

## Vocabulary Lesson checks

- `learn_new_words`, `review_weak_words`, and `mixed_practice`: HTTP 200.
- Word list, pagination, and search: HTTP 200.
- Full interactive drill: 30 captured UI states, including answers, feedback, checkpoint, and completion.
- No horizontal overflow or missing form labels in the interactive run.
- Unauthenticated attempt: HTTP 401.
- Forged exercise submission: HTTP 400.

## Operational note

An audiobook player is shown only when the lesson passage has an `audio_url`. The audited audio lesson was `Chapter 1 — Part 4` (`b4679e49-e878-4cf4-8fc9-5e8bde846a25`). Lessons whose passage has no uploaded audio correctly omit the player.

