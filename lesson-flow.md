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
- full-width mobile-first reading screen
- long-press a passage word to capture it quickly
- add vocabulary manually if needed
- see known words underlined for the current student
- show a compact review-submit block below the passage

Current analytics hooks:
- reading stage start is tracked client-side
- a lesson open event updates reading progress for Books mode

## Stage 2 — Vocabulary Review
After `Submit Vocabulary`:
- captured items are processed in bulk
- vocabulary cards are generated in bulk
- audio is generated in bulk when available
- cards are shown one by one
- captured lesson words are stored so they can later enter Vocabulary Studio with lesson-aware context
- capture metadata can now preserve where the word came from:
  - passage
  - question
  - answer

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
- double tap a saved word to play audio when available
- reading metrics are finalized when the reading stage ends

## Stage 4 — Questions
Quiz runs one question at a time.

Current behavior:
- select answer
- submit
- see correct / incorrect state
- see explanation
- open a temporary `See Passage` view and return back to the same question
- long press words in question text or answer text to capture them into lesson vocabulary
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
- lesson-derived vocabulary is automatically generated and normalized into drill-ready items

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

Current bridge behavior:
- lesson-derived words keep their lesson linkage through `lesson_id`
- source context comes from captured passage/question/answer snippets, `context_sentence`, and `example_text`
- answer sets for key drill types are normalized and stored before the words become session-ready
- fresh lesson words can later reappear in Vocabulary Studio through a softer first-exposure path:
  - `meaning_match`
  - `translation_match`
  - `pair_match`
  - `context_meaning`
  - `fill_blank`
- when the session gets more demanding, they may later enter:
  - `sentence_builder`
  - `error_detection`
  - `listen_match`
  - `spelling_from_audio`
- adaptive difficulty can keep those first lesson-linked exposures on a more supportive path before the session grows more demanding

## Current Vocabulary Studio Follow-Through
Vocabulary Studio now closes the loop after a student finishes a vocab session:
- per-exercise attempts are persisted
- `word_progress` is updated
- `review_queue` is regenerated
- the focused drill route keeps the interaction full-screen and mobile-first
- the main Vocabulary Studio page can also render the live drill player inline
- the session is no longer framed as “finish your due count”
- the first checkpoint can roll into endless continuation without rebuilding a parallel session system
- an end-of-session results summary highlights:
  - correct / incorrect totals
  - weak words from the session
  - strengthened words
  - recovery, new-lesson, and retention-check words when available

## Current Drill Capture Layer
Inside vocabulary drills:
- long press can capture useful words from answer choices
- long press can capture distractors
- long press can capture sentence fragments and drill context text
- captures reuse `vocabulary_capture_events`
- drill captures now store source-aware metadata including:
  - `source: vocab_drill`
  - `drill_type`
  - `is_distractor`
  - `context`

## Current Vocabulary Analytics Layer
Vocabulary work is now measurable outside the session itself.

Current analytics surfaces use:
- `exercise_attempts`
- `word_progress`

Current summaries include:
- total vocab exercises completed
- accuracy by exercise type
- accuracy by modality
- recent weak words
- mastery distribution by lifecycle state
- recent vocab session counts
- most frequently missed words
- recently improved words
- progress-first student metrics:
  - `Captured`
  - `Mastered`
  - `Practiced today`

That makes the lesson flow and vocabulary flow connected, but still separate products.

## Current Testing / Debug Tools
- reset lesson button
- regenerate audio button
- exercise telemetry debug panels
- exercise gallery at `/test/exercise-gallery`
