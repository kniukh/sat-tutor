# SAT Tutor — Database Overview

This document summarizes the current logical schema and the tables most relevant to the active product.

## Schema Principles
- Keep source content separate from student runtime state.
- Keep AI pipeline outputs separate from final student-facing lesson data.
- Keep vocabulary review state separate from raw attempt history.
- Books remain linear in progression even when analytics and vocab adaptation grow around them.

## Core Layers
- Identity / access
- Source content
- AI pipeline
- Reading lesson runtime
- Vocabulary and review scheduling
- Analytics and adaptive support
- Book progress
- Gamification / progress

## Identity / Access

### `students`
Student identity and access-code login.

Important fields:
- `id`
- `full_name`
- `access_code`
- `native_language`
- `is_active`
- `created_at`
- `updated_at`

## Source / Content

### `source_documents`
Root entity for books and source texts.

Important fields:
- `id`
- `title`
- `author`
- `source_type`
- `raw_text`
- `upload_kind`
- `pdf_file_path`
- `pdf_processing_status`

### `source_document_pages`
Raw extracted PDF pages.

### `source_document_structure`
AI-detected structural boundaries and chapter metadata.

### `source_document_clean_text`
Canonical clean chapter text used for chunking.

### `generated_passages`
Bridge between source material and lessons.

Important fields:
- `source_document_id`
- `lesson_id`
- `chapter_index`
- `chapter_title`
- `chunk_index`
- `passage_text`
- `word_count`
- `status`
- analyzer metadata such as `difficulty_level`, `text_mode`, `vocab_density`

Important product use:
- `generated_passages.lesson_id + generated_passages.source_document_id` link lessons back to books
- `chapter_index` and `chapter_title` drive the chapter-grouped Books UI

### `lessons`
Main student-facing lesson unit.

Important fields:
- `id`
- `name`
- `lesson_type`
- `status`
- `is_active`
- `display_order`
- `unit_id`

### `lesson_passages`
Final lesson passage text shown in the runtime lesson.

### `question_bank`
Lesson questions.

Important fields:
- `lesson_id`
- `question_type`
- `question_text`
- `option_a` to `option_d`
- `correct_option`
- `explanation`
- `difficulty`
- `display_order`

### `lesson_writing_prompts`
Writing prompts attached to lessons.

## Reading Lesson Runtime

### `student_lesson_state`
Operational lesson state for the stage-based lesson flow.

Important fields:
- `student_id`
- `lesson_id`
- `stage`
- `vocab_submitted`
- `second_read_done`
- `question_answers_json`
- `current_question_index`

Current stage values:
- `first_read`
- `vocab_review`
- `second_read`
- `questions`
- `completed`

### `lesson_attempts`
Lesson completion history and lesson-level analytics.

Important fields:
- `student_id`
- `lesson_id`
- `score`
- `total_questions`
- `accuracy`
- `weak_skills`
- `answers_json`
- `completed_at`

### `lesson_reading_metrics`
Per-lesson reading-stage metrics.

Important fields:
- `student_id`
- `lesson_id`
- `reading_duration_sec`
- `words_count`
- `words_per_minute`
- `created_at`

Source:
- created from `/api/reading/metrics`
- driven by reading stage timing in the lesson UI

### `question_attempts`
Per-question timing telemetry.

Important fields:
- `student_id`
- `lesson_id`
- `question_id`
- `time_spent_ms`
- `selected_option`
- `is_correct`
- `created_at`

Source:
- created from `/api/question-attempt`

### `mistake_analysis`
AI-generated post-lesson mistake analysis.

Important fields:
- `student_id`
- `lesson_id`
- `question_id`
- `question_type`
- `mistake_type`
- `confidence`
- `short_reason`
- `coaching_tip`
- `created_at`

Allowed `mistake_type` values:
- `careless_misread`
- `vocab_gap`
- `inference_failure`
- `main_idea_confusion`
- `evidence_selection_failure`

Source:
- generated after lesson completion by Mistake Brain

## Vocabulary Capture and Cards

### `vocabulary_capture_events`
Raw log of words and phrases captured by the student.

Important fields:
- `student_id`
- `lesson_id`
- `passage_id`
- `item_text`
- `item_type`
- `context_text`
- `source_type`
- `created_at`

Current capture sources:
- `passage`
- `question`
- `answer`

### `vocabulary_item_details`
Enriched vocabulary cards per student and lesson.

Important fields:
- `student_id`
- `lesson_id`
- `item_text`
- `item_type`
- `english_explanation`
- `translated_explanation`
- `translation_language`
- `example_text`
- `context_sentence`
- `distractors`
- `audio_url`
- `audio_status`
- `is_understood`

Current role in product flow:
- stores the lesson-derived vocabulary cards that later feed Vocabulary Studio
- keeps the original lesson linkage through `lesson_id`
- keeps sentence-level context through `context_sentence` and `example_text`
- now also keeps source-aware capture context from reading passage, quiz question text, or answer text

## Vocab Attempts, Progress, and Scheduling

### `exercise_attempts`
Normalized per-exercise vocab attempt history.

Important fields:
- `student_id`
- `lesson_id`
- `session_id`
- `exercise_id`
- `exercise_type`
- `target_word_id`
- `target_word`
- `modality`
- `difficulty_band`
- `user_answer`
- `correct_answer`
- `is_correct`
- `attempt_count`
- `response_time_ms`
- `confidence`
- `metadata`
- `created_at`

Current use:
- one row per completed vocab exercise attempt
- receives data from `/api/vocabulary/exercise-attempt`
- now also serves as the base telemetry source for Vocabulary Analytics v1

### `word_progress`
Per-student word lifecycle and review state.

Legacy fields still exist for compatibility:
- `word`
- `item_type`
- `status`
- `times_seen`
- `times_correct`
- `times_wrong`
- `next_review_date`

Current adaptive-review fields:
- `student_id`
- `word_id`
- `lifecycle_state`
- `current_difficulty_band`
- `mastery_score`
- `total_attempts`
- `correct_attempts`
- `last_seen_at`
- `next_review_at`
- `consecutive_correct`
- `consecutive_incorrect`
- `last_modality`
- `metadata`
- `created_at`
- `updated_at`

Current lifecycle states:
- `new`
- `learning`
- `review`
- `mastered`
- `weak_again`

Current role in adaptation:
- stores the rolling difficulty band used by adaptive difficulty v1
- anchors weak-word and mastery-distribution analytics

### `review_queue`
Rule-based review scheduling queue.

Important fields:
- `student_id`
- `word_id`
- `priority_score`
- `scheduled_for`
- `reason`
- `recommended_modality`
- `source_attempt_id`
- `status`
- `created_at`
- `updated_at`

Current queue priorities favor:
- recently failed words
- `weak_again` words
- overdue review words
- reinforcement words

## Book Progress

### `student_book_progress`
Resume state and progress summary for books.

Important fields:
- `student_id`
- `source_document_id`
- `current_lesson_id`
- `last_opened_at`
- `completed_lessons_count`
- `total_lessons_count`
- `progress_percent`

Current use:
- drives Books library featured card
- drives chapter-aware book detail CTA and progress summary

## Other Progress / Analytics

### `skill_mastery`
Per-student skill performance summary.

### `student_gamification`
XP, level, streak, achievements.

## Vocabulary Analytics v1

Current analytics surfaces are built from existing vocab tables rather than a separate warehouse table.

Main sources:
- `exercise_attempts`
  - total vocab exercises completed
  - accuracy by exercise type
  - accuracy by modality
  - recent session counts
  - most frequently missed words
  - 7-day improvement summaries
- `word_progress`
  - recent weak words
  - mastery distribution by lifecycle state
  - current difficulty band / weak streak context

## Current Main Flows

### Book content flow
`source_documents`
-> `source_document_pages`
-> `source_document_structure`
-> `source_document_clean_text`
-> `generated_passages`
-> `lessons`
-> `lesson_passages`
-> `question_bank`

### Reading lesson runtime flow
`students`
-> `student_lesson_state`
-> `lesson_attempts`
-> `lesson_reading_metrics`
-> `question_attempts`
-> `mistake_analysis`

### Vocabulary adaptive flow
`vocabulary_capture_events`
-> `vocabulary_item_details`
-> `exercise_attempts`
-> `word_progress`
-> `review_queue`

### Vocabulary analytics flow
`exercise_attempts`
plus
`word_progress`
-> `services/analytics/vocabulary-analytics.service.ts`
-> dashboard / progress surfaces

### Lesson-to-vocabulary bridge
`lesson_passages`
-> inline capture / lesson vocabulary submit
-> `vocabulary_capture_events`
-> `vocabulary_item_details`
-> Vocabulary Studio session shaping

Current note:
- the bridge is still rule-based
- lesson linkage is carried mostly through `lesson_id`, context sentence fields, and service-layer source metadata on exercises

### Book progress flow
`students`
-> `student_book_progress`
-> `source_documents`
-> `generated_passages`
-> `lessons`

## Key Product Decisions Reflected In The DB
- Books remain linear. `student_book_progress.current_lesson_id` tracks progress, not adaptive rerouting.
- Chapter grouping for books comes from `generated_passages.chapter_index` and `generated_passages.chapter_title`.
- Vocab telemetry is stored before adaptive scheduling is applied.
- Lesson vocabulary remains tied to the originating lesson through stored lesson/context fields instead of a separate session-source table.
- `exercise_attempts` feed `word_progress`.
- `word_progress` feeds `review_queue`.
- `exercise_attempts` and `word_progress` also feed Vocabulary Analytics v1.
- Mistake Brain writes post-lesson AI analysis into `mistake_analysis`.

## Recent Migrations
- `20260328170000_add_reading_metrics_and_question_attempts.sql`
- `20260328173000_add_mistake_analysis.sql`
- `20260328190000_add_vocab_exercise_tracking.sql`
- `20260328204000_update_word_progress_lifecycle_weak_again.sql`
