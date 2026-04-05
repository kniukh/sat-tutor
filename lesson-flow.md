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
- long-press a passage word on mobile or select text on desktop to capture it quickly
- selection popups can save immediately and load meaning only on demand through `Show Meaning`
- add vocabulary manually if needed
- see known words underlined for the current student without extra highlight backgrounds
- manage captured words in a floating `W` Word Bank tray
- use `Continue` as a checkpoint CTA instead of a submit-centric vocabulary action

Current analytics hooks:
- reading stage start is tracked client-side
- a lesson open event updates reading progress for Books mode

## Stage 2 — Vocabulary Review
After `Continue`:
- pending Word Bank items are checkpoint-saved
- vocabulary review opens quickly from saved/fallback data
- cards are paged for mobile-friendly review
- captured lesson words are stored so they can later enter Vocabulary Studio with lesson-aware context
- capture metadata can now preserve where the word came from:
  - passage
  - question
  - answer
  - vocab drill

Vocabulary card content may include:
- word or phrase
- English explanation
- translation
- example

Current performance rule:
- card meanings and translations should come from existing preview data or shared dictionary cache first
- heavier enrichment and audio work should not block the stage transition

## Stage 3 — Second Read
Student rereads the passage with more support.

Current behavior:
- known words remain visible in the passage
- hover/tap a saved word to see meaning + translation quickly
- reading metrics are finalized when the reading stage ends

## Stage 4 — Questions
Quiz runs one question at a time.

Current behavior:
- select answer
- submit
- if correct, show success feedback
- if wrong, show short trap-aware feedback without revealing the correct answer immediately
- optionally open a `Why?` bottom sheet for structured reasoning help
- open a temporary `See Passage` view and return back to the same question
- select words on desktop or long press on mobile in question text / answer text to capture them into lesson vocabulary
- captured quiz/repair words go into the same floating Word Bank tray
- after the last quiz question, `Words Picked Up from Quiz` appears before repair if the student captured quiz words
- continue to next question

Current repair behavior:
- missed questions are retried in their original SAT form during repair
- there is no separate `You missed this` reveal screen inside lesson repair anymore
- `See Passage` opens the relevant passage context and returns back to the same repair question
- the overlay button reads `Back to Question` during repair

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
- completion screen offers `Continue Reading` or `Back to Library` depending on whether a next lesson exists, plus `Go to Vocabulary` and `Return to Dashboard`

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
- inline vocabulary popups and cards should prefer cache-first data and short fallback copy instead of blocking the reader

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
- shared `vocabulary_dictionary_cache` is checked before AI when a card meaning, translation, distractors, or drill answer sets are needed
- fresh lesson words can later reappear in Vocabulary Studio through a softer first-exposure path:
  - `meaning_match`
  - `translation_match`
  - `pair_match`
  - `context_meaning`
- when the session gets more demanding, they may later enter:
  - `listen_match`
  - `spelling_from_audio`
  - `error_detection`
  - `synonym`
  - `collocation`
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
- current live session mix emphasizes `meaning_match`, `translation_match`, `pair_match`, `listen_match`, `spelling_from_audio`, `error_detection`, `context_meaning`, `synonym`, and `collocation`
- `listen_match` now ships in both `audio -> English` and `audio -> translation` variants when enough audio-ready items exist
- an end-of-session results summary highlights:
  - correct / incorrect totals
  - weak words from the session
  - strengthened words
  - recovery, new-lesson, and retention-check words when available
- results can now also branch into:
  - `Replay Mistakes`
  - `View your weak areas`

## Current Mistake Replay Layer
Mistake Replay is a short repair mode rather than a static wrong-answer list.

Current source inputs:
- recent incorrect `question_attempts`
- recent incorrect `exercise_attempts`
- weak skills from repeated reading misses
- weak / repeated vocabulary items from `word_progress`

Current flow per replay item:
- `You missed this`
- `Why it was wrong`
- `Try again`
- `Next`

Current product note:
- reading replay reuses the same reading question models and `question_attempts`
- vocab replay reuses the same vocab attempt logging and normalized answer sets
- replay is optional and launched from Insights or session results instead of interrupting the main learning flow
- lesson repair in the main reading flow now follows the same “retry original item” habit instead of showing the correct answer upfront

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
