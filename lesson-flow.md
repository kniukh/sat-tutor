# SAT Tutor — Lesson Flow

This document covers the current student reading lesson flow and the main post-lesson hooks that now run around it.

## Goal Of One Reading Lesson
Each lesson should produce five outcomes:
1. the student reads the passage
2. the student captures and reviews useful vocabulary
3. the student answers SAT-style questions
4. the system records performance and timing
5. the system updates progress and post-lesson analytics

## Current Reading Lesson Stages
- `first_read`
- `vocab_review`
- `second_read`
- `questions`
- `completed`

## Stage 1 — First Read
Student sees the passage and can collect unknown words or phrases.

Current supported actions:
- add vocabulary manually
- select text inline in the passage and capture it
- see known words underlined for the current student
- open hover mini-cards for known words
- pin the mini-card

Current analytics hooks:
- reading stage start is tracked client-side
- a lesson open event updates reading progress for Books mode

## Stage 2 — Vocabulary Review
After `Submit Vocabulary`:
- captured items are processed in bulk
- vocabulary cards are generated in bulk
- audio is generated in bulk when available
- cards are shown one by one

Vocabulary card content may include:
- word or phrase
- English explanation
- translation
- context sentence
- example
- audio

## Stage 3 — Second Read
Student rereads the passage with more support.

Current behavior:
- known words remain visible in the passage
- student can continue to inspect saved vocabulary
- reading metrics are finalized when the reading stage ends

## Stage 4 — Questions
Quiz runs one question at a time.

Current behavior:
- select answer
- submit
- see correct / incorrect state
- see explanation
- continue to next question

Current analytics hooks:
- per-question timing is saved through `/api/question-attempt`
- question type acts as the skill tag for tracking

## Stage 5 — Completed
When the lesson is completed:
- `lesson_attempts` row is created
- score and accuracy are saved
- weak skills are calculated
- `student_lesson_state.stage` moves to `completed`
- skill tracking is updated
- Mistake Brain runs after completion

## Current Post-Lesson AI Layer

### Mistake Brain v1
After lesson completion:
- latest lesson attempt is loaded
- wrong answers are gathered
- question metadata and passage context are loaded
- one bulk OpenAI analysis classifies mistakes
- results are written to `mistake_analysis`

Current mistake types:
- `careless_misread`
- `vocab_gap`
- `inference_failure`
- `main_idea_confusion`
- `evidence_selection_failure`

## Current Reading Analytics Layer

### Reading metrics
Saved via `/api/reading/metrics`.

Current fields:
- reading duration
- words count
- words per minute

### Question timing
Saved via `/api/question-attempt`.

Current fields include:
- question id
- selected answer
- correctness
- time spent

## Current AI Tutor Flow
Inside the interactive passage reader:
- student selects text
- clicks `Explain`
- request goes to `/api/ai/tutor`
- short answer is returned from `gpt-4o-mini`
- popup shows explanation
- loading and error states are handled in the client

## Product Constraint For Books
Books stay linear.

This means:
- lesson sequence inside a book is not rerouted adaptively
- analytics may influence support around the book
- analytics should not break chapter order

## Related Vocabulary Flow Outside The Lesson
The separate Vocabulary Studio is not part of the reading lesson stage machine, but it now consumes the outputs of lesson work:
- captured / prepared vocabulary
- `exercise_attempts`
- `word_progress`
- `review_queue`

That makes the lesson flow and vocabulary flow connected, but still separate products.

## Current Testing / Debug Tools
- reset lesson button
- regenerate audio button
- exercise telemetry debug panels
- exercise gallery at `/test/exercise-gallery`
