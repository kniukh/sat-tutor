# SAT AI Tutor — Working Documentation

## Purpose

This document is the living working documentation for the SAT AI Tutor project. It is intended to keep the current architecture, database model, lesson flow, and implementation decisions in one place so future work can continue without reconstructing context from chat history.

---

# 1. Product Structure

## Student flow

Login → Student Dashboard → Subject selection → SAT Reading → one of:

* Books
* Articles
* Vocabulary Drills

## SAT Reading subcategories

### Books

Student opens a book and continues from the previous saved position. Content is delivered in chapter order and then chunk order.

### Articles

Student opens article lessons in the order defined by admin.

### Vocabulary Drills

Separate lesson player focused on review and retention. This is distinct from the Reading Lesson Player and still needs further development.

---

# 2. Reading Lesson Player

## Layout

The screen is split into two horizontal draggable panels:

* Top panel: reading text
* Bottom panel: vocabulary area during reading, then quiz area later

## Reading and vocabulary capture

During reading, the student can:

* type unknown words manually
* ideally highlight a word or phrase in the text and add it to vocabulary with a click

After the student presses **Submit Vocabulary**:

* vocabulary cards are generated once for all selected items
* cards are shown one by one with a Next button
* each card includes:

  * explanation
  * translation
  * audio
  * contextual example

In future texts, selected words should be underlined, and hovering should show a reminder popup.

## Quiz stage

After vocabulary review, the player moves to quiz mode:

* top panel: question
* bottom panel: answer options
* one question per screen
* Next after each question
* Finish Lesson after the last question

## Save and resume

The system saves progress so a student can reopen a selected book and continue from the previous location.

---

# 3. Source Pipeline

## Admin-side source flow

Admin uploads a book.
The book is manually edited so the system knows where **Chapter 1 Start** and **Chapter 1 End** are.

Then the pipeline works as follows:

1. Extract chapter text
2. AI divides chapter into logical chunks
3. AI generates:

   * 3 SAT-style questions
   * 2 vocabulary questions
4. Content is stored and linked into lessons

## Important architectural principle

Pipeline work should happen before runtime whenever possible.
Do not generate everything live during the student lesson if it can be preprocessed earlier.

---

# 4. Database Architecture

Source: previously captured DB architecture notes, now normalized into working documentation.

## 4.1 Architectural principle

The database is divided into 6 logical layers:

* Identity / Access
* Content
* AI Pipeline
* Learning State
* Vocabulary
* Progress / Gamification

This separation is important because the system has three fundamentally different levels:

* source-level data
* AI intermediate data
* student runtime data

These must not be mixed.

---

## 4.2 Identity / Access

### students

Stores student identities.

**Purpose**

* student identity
* access code
* native language
* active or inactive state

**Fields**

* id uuid pk
* full_name text
* email text null
* access_code text unique
* native_language text (`ru | ro | en`)
* is_active boolean
* created_at timestamptz
* updated_at timestamptz

---

## 4.3 Lesson Content Layer

### lessons

Base student-facing lesson unit.

**Purpose**

* lesson as the main unit of completion
* link to generated passage
* entry point for runtime

**Fields**

* id uuid pk
* name text
* slug text unique
* lesson_type text
* status text (`draft | published | archived`)
* is_active boolean
* display_order integer
* unit_id uuid null
* created_at timestamptz
* updated_at timestamptz

### lesson_passages

Passage text inside the lesson.
Usually one passage per lesson, but can support several.

**Fields**

* id uuid pk
* lesson_id uuid fk -> lessons.id
* title text null
* passage_text text
* display_order integer
* created_at timestamptz

### question_bank

Stores SAT-style and vocabulary-related questions.

**Purpose**

* SAT-style questions
* vocabulary questions
* phrase meaning questions

**Fields**

* id uuid pk
* lesson_id uuid fk -> lessons.id
* question_type text
* question_text text
* option_a text
* option_b text
* option_c text
* option_d text
* correct_option text
* explanation text
* difficulty integer
* display_order integer
* review_status text
* generation_source text
* generation_version integer
* created_at timestamptz

**Recommended question types**

* main_idea
* detail
* inference
* tone
* vocab_in_context
* phrase_meaning
* contextual_paraphrase

### lesson_writing_prompts

Writing tasks linked to a lesson.

**Fields**

* id uuid pk
* lesson_id uuid fk -> lessons.id
* prompt_text text
* prompt_type text default `short_answer`
* is_active boolean
* created_at timestamptz

---

## 4.4 Source Documents / Books Layer

### source_documents

Root entity for books or source texts.

**Purpose**

* book as curriculum source
* starting point for the pipeline

**Fields**

* id uuid pk
* title text
* author text null
* source_type text
* raw_text text
* upload_kind text (`raw_text | pdf`)
* pdf_file_path text null
* pdf_processing_status text
* created_at timestamptz
* updated_at timestamptz

**Recommended pdf_processing_status values**

* uploaded
* pages_extracted
* structured
* cleaned
* chunked
* analyzed
* failed

### source_document_pages

Raw extracted PDF pages.

**Fields**

* id uuid pk
* source_document_id uuid fk -> source_documents.id
* page_number integer
* raw_text text
* created_at timestamptz

**Constraint**

* unique (source_document_id, page_number)

### source_document_structure

AI-detected structure of the document.

**Purpose**

* front matter boundaries
* body boundaries
* chapter detection
* excluded sections

**Fields**

* id uuid pk
* source_document_id uuid unique fk -> source_documents.id
* front_matter_end_page integer null
* body_start_page integer null
* body_end_page integer null
* detected_chapters_json jsonb
* excluded_sections_json jsonb
* cleaning_notes text
* created_at timestamptz
* updated_at timestamptz

### source_document_clean_text

Canonical cleaned chapter text.

**Purpose**

* final clean chapter text
* source for chunking

**Fields**

* id uuid pk
* source_document_id uuid fk -> source_documents.id
* chapter_index integer
* chapter_title text
* clean_text text
* created_at timestamptz
* updated_at timestamptz

**Constraint**

* unique (source_document_id, chapter_index)

---

## 4.5 Generated Passages / AI Pipeline Layer

### generated_passages

Intermediate AI layer between source books and lessons.

**Purpose**

* chunked passages from clean book text
* analyzer metadata
* bridge between source and final lesson

**Fields**

* id uuid pk
* source_document_id uuid fk -> source_documents.id
* lesson_id uuid null fk -> lessons.id
* title text
* chunk_index integer
* chapter_index integer null
* chapter_title text null
* passage_text text
* word_count integer
* status text
* passage_role text null
* question_strategy text null
* recommended_question_count integer null
* recommended_question_types jsonb
* analyzer_reason text null

**Analyzer V2 fields**

* difficulty_level text null
* text_mode text null
* vocab_density text null
* phrase_density text null
* writing_prompt_worthy boolean
* recommended_vocab_questions_count integer
* recommended_vocab_target_words jsonb
* recommended_vocab_target_phrases jsonb

**Recommended enum-like values**

status:

* draft
* approved
* archived

passage_role:

* assessment
* context
* bridge

question_strategy:

* full_set
* light_check
* none

difficulty_level:

* easy
* medium
* hard

text_mode:

* narrative
* dialogue
* descriptive
* analytical

vocab_density:

* low
* medium
* high

phrase_density:

* low
* medium
* high

---

## 4.6 Lesson Runtime / Student State

### student_lesson_state

Main operational table for lesson flow.

**Purpose**

* current lesson stage
* autosave answers
* current question index

**Fields**

* id uuid pk
* student_id uuid fk -> students.id
* lesson_id uuid fk -> lessons.id
* stage text
* vocab_submitted boolean
* second_read_done boolean
* question_answers_json jsonb
* current_question_index integer
* created_at timestamptz
* updated_at timestamptz

**Constraint**

* unique (student_id, lesson_id)

**Stages**

* first_read
* vocab_review
* second_read
* questions
* completed

### lesson_attempts

Stores completion history and analytics.

**Purpose**

* lesson analytics
* progress
* weak skills
* historical record

**Fields**

* id uuid pk
* student_id uuid fk -> students.id
* lesson_id uuid fk -> lessons.id
* score integer
* total_questions integer
* accuracy numeric
* weak_skills jsonb
* weak_words jsonb
* answers_json jsonb
* completed_at timestamptz
* created_at timestamptz

### student_writing_submissions

Stores lesson writing responses.

**Fields**

* id uuid pk
* student_id uuid fk -> students.id
* lesson_id uuid fk -> lessons.id
* writing_prompt_id uuid fk -> lesson_writing_prompts.id
* response_text text
* ai_feedback jsonb
* created_at timestamptz
* updated_at timestamptz

---

## 4.7 Vocabulary Layer

### vocabulary_capture_events

Every time a student adds a word or phrase.

**Purpose**

* raw capture log
* first-read capture
* inline selection capture

**Fields**

* id uuid pk
* student_id uuid fk -> students.id
* lesson_id uuid fk -> lessons.id
* passage_id uuid fk -> lesson_passages.id
* item_text text
* item_type text (`word | phrase`)
* context_text text null
* created_at timestamptz

### vocabulary_item_details

Enriched vocabulary records for a student and lesson.

**Purpose**

* English meaning
* translation
* example
* context sentence
* audio
* understood flag

**Fields**

* id uuid pk
* student_id uuid fk -> students.id
* lesson_id uuid fk -> lessons.id
* item_text text
* item_type text
* english_explanation text null
* translated_explanation text null
* translation_language text
* example_text text null
* context_sentence text null
* is_understood boolean
* distractors jsonb
* audio_url text null
* audio_status text
* created_at timestamptz

**Recommended audio_status values**

* pending
* ready
* failed

### word_progress

SRS and review engine.

**Purpose**

* due vocabulary
* retention tracking
* drill engine

**Fields**

* id uuid pk
* student_id uuid fk -> students.id
* word text
* item_type text
* status text
* times_seen integer
* times_correct integer
* times_wrong integer
* next_review_date date
* source_lesson_id uuid fk -> lessons.id
* metadata jsonb
* created_at timestamptz
* updated_at timestamptz

**Recommended status values**

* learning
* review
* mastered

---

## 4.8 Book Progress Layer

### student_book_progress

Stores book resume state.

**Purpose**

* resume reading
* percent complete
* current lesson in the book

**Fields**

* id uuid pk
* student_id uuid fk -> students.id
* source_document_id uuid fk -> source_documents.id
* current_lesson_id uuid null fk -> lessons.id
* last_opened_at timestamptz
* completed_lessons_count integer
* total_lessons_count integer
* progress_percent numeric
* created_at timestamptz
* updated_at timestamptz

**Constraint**

* unique (student_id, source_document_id)

---

## 4.9 Gamification Layer

### student_gamification

Simple gamification state.

**Fields**

* id uuid pk
* student_id uuid unique fk -> students.id
* xp integer
* level integer
* streak_days integer
* last_activity_date date null
* achievements jsonb
* created_at timestamptz
* updated_at timestamptz

---

# 5. Recommended Relationships

## Main content flow

source_documents
→ source_document_pages
→ source_document_structure
→ source_document_clean_text
→ generated_passages
→ lessons
→ lesson_passages
→ question_bank
→ lesson_writing_prompts

## Student flow

students
→ student_lesson_state
→ lesson_attempts
→ student_writing_submissions
→ vocabulary_capture_events
→ vocabulary_item_details
→ word_progress
→ student_book_progress
→ student_gamification

---

# 6. Recommended Indexes

Minimum recommended indexes:

* students(access_code)
* lesson_attempts(student_id)
* question_bank(lesson_id)
* lesson_passages(lesson_id)
* generated_passages(source_document_id)
* generated_passages(lesson_id)
* source_document_pages(source_document_id, page_number)
* source_document_clean_text(source_document_id, chapter_index)
* word_progress(student_id, next_review_date)
* vocabulary_item_details(student_id, lesson_id)
* student_lesson_state(student_id, lesson_id)
* student_book_progress(student_id, source_document_id)

---

# 7. Known Weak Points

Current weakest areas are not the lesson runtime layer, but the source pipeline layer:

* PDF extraction is still too raw
* chapter detection is still weak
* clean text builder is still simple
* Analyzer V2 is not yet fully connected to question generation
* status enums are not fully unified everywhere

---

# 8. Approved Product and Lesson Decisions

The following decisions are currently approved:

## Product structure

* Student Dashboard should include SAT Reading first; SAT Writing and SAT Math can remain placeholders for now.
* SAT Reading contains Books, Articles, Vocabulary Drills.

## Reading Lesson Player

* Two horizontal panels
* Draggable layout
* Top = text
* Bottom = vocabulary capture first, quiz later
* Inline vocabulary selection is a target feature

## Vocabulary flow

* Student captures words during reading
* Student submits vocabulary once
* System generates cards once for all selected words
* Cards include explanation, translation, audio, and contextual example
* Selected words should later appear underlined in future texts with hover reminders

## Lesson flow

* first_read
* vocab_review
* second_read
* questions
* completed

## Source pipeline

* Chapters are manually bounded at the source stage when needed
* AI performs chunking
* AI generates SAT-style and vocabulary questions
* Preprocessing is preferred over runtime generation

---

# 9. Next Recommended Documentation Sections

To expand this working doc later, add:

* current code map
* Supabase schema diffs
* lesson runtime API contracts
* admin upload workflow
* Question Generator rules
* Vocab card generation rules
* UI screen specs
* migration log

---

# 10. Code Structure (Current)

## High-level folder tree

```
src/
  app/
    admin/
      page.tsx
      lessons/
      sources/
      students/
    api/
      admin/
      lesson/
      reading/
      vocabulary/
      writing/
    s/
      [code]/
        page.tsx
        book/
        lesson/
        progress/
        vocabulary/

  components/
    admin/
    student/

  lib/
    auth/
    supabase/
    openai.ts

  services/
    ai/
    analytics/
    content/
    gamification/
    lesson-state/
    pdf/
    progress/
    reading/
    recommendations/
    vocabulary/
```

## Architecture interpretation

### app/

* admin: admin UI (content management, sources, lessons, students)
* api: backend endpoints grouped by domain
* s/[code]: student-facing application (entry via access code)

### components/

* admin: admin UI components
* student: lesson player, dashboard, vocabulary UI

### lib/

* auth: authentication logic
* supabase: DB client and helpers
* openai.ts: core AI entry point

### services/ (core business logic layer)

This is the most important layer in the system.

* ai: AI orchestration and prompts
* analytics: lesson analytics and performance
* content: lesson/content building logic
* gamification: XP, streaks, achievements
* lesson-state: runtime lesson flow management
* pdf: PDF extraction and preprocessing pipeline
* progress: book and lesson progress tracking
* reading: reading lesson orchestration
* recommendations: adaptive next-step logic
* vocabulary: vocab capture, generation, SRS

## Key architectural principle

The `services/` layer should contain all business logic. The `app/api/` layer should remain thin and only call services.

---

# 11. Detailed Route and Layer Architecture

Source: detailed architecture notes provided later and consolidated here. fileciteturn1file0

## 11.1 `src/app` — routes layer

This is the UI and API entry layer.

### Student-facing routes: `src/app/s/...`

#### `src/app/s/[code]/page.tsx`

Student dashboard route.
Loads aggregated student data and renders `StudentDashboard`.

#### `src/app/s/[code]/book/page.tsx`

Book overview route.
Shows reading path, progress, and resume reading.

#### `src/app/s/[code]/lesson/[lessonId]/page.tsx`

Main lesson route.
Composes:

* student
* lesson
* lesson state
* vocab items
* writing prompt
* writing history
* reading sequence

Then renders the split lesson UI.

#### `src/app/s/[code]/progress/page.tsx`

Progress page.

#### `src/app/s/[code]/vocabulary/page.tsx`

Vocabulary drills page.

### Admin-facing routes: `src/app/admin/...`

#### `src/app/admin/page.tsx`

Admin dashboard.

#### `src/app/admin/lessons/page.tsx`

Lessons list.

#### `src/app/admin/lessons/[lessonId]/page.tsx`

Lesson detail page.
Handles:

* passages
* questions
* writing prompts
* writing submissions
* generation buttons

#### `src/app/admin/sources/page.tsx`

Source documents list and upload.

#### `src/app/admin/sources/[sourceId]/page.tsx`

PDF/source pipeline control center.

#### `src/app/admin/students/page.tsx`

Students list.

#### `src/app/admin/students/[studentId]/page.tsx`

Student detail page.

### API routes: `src/app/api/...`

Thin orchestration layer.
Responsibilities:

* validate input
* call services
* read/write Supabase
* return JSON

---

## 11.2 `src/components/student` — student UI layer

This is the presentation and client interactivity layer for the student side.

### Lesson runtime core

#### `LessonPlayer.tsx`

Question engine.
Features:

* one-question-at-a-time
* keyboard shortcuts
* autosave
* submit
* sticky controls

Depends on:

* `/api/lesson/save-question-progress`
* `/api/lesson/submit`
* `/api/lesson/advance-stage`

#### `QuestionWorkspace.tsx`

Client wrapper around `LessonPlayer`.
Purpose:

* hold live question progress
* pass progress to the HUD

Depends on:

* `LessonProgressHud`
* `LessonPlayer`

#### `LessonProgressHud.tsx`

HUD for lesson progress.
Shows:

* part
* stage
* words collected
* questions left

#### `LessonSplitLayout.tsx`

Split-screen draggable layout.
Purpose:

* top area for passage
* bottom area for workspace
* draggable divider

### Lesson stage UI

#### `LessonStagePanel.tsx`

Stage-driven workspace UI for:

* first read
* vocab review
* second read
* completed

Depends on:

* vocabulary APIs
* stage APIs
* `VocabularyReviewCards`

#### `PassageVocabularyCapture.tsx`

Manual unknown word/phrase capture.

#### `InteractivePassageReader.tsx`

Interactive passage surface.
Features:

* click saved word
* click saved phrase
* inline preview
* inline save
* play audio

Depends on:

* `/api/vocabulary/preview-inline`
* `/api/vocabulary/capture-inline`
* `/api/vocabulary/generate-audio`

#### `ReadingProgressTracker.tsx`

Invisible tracker component.
Purpose:

* sends lesson open event to update book progress

### Vocabulary UI

#### `VocabularyReviewCards.tsx`

Vocabulary explanation cards with understood toggle.

#### `PrepareVocabularyDrillsButton.tsx`

Prepares distractors.

#### `VocabularyDrillPlayer.tsx`

Word meaning and phrase paraphrase drills.

#### `ClozeDrillPlayer.tsx`

Cloze drills from context sentence.

### Writing UI

#### `WritingPanel.tsx`

Short-answer writing submission and AI feedback.

#### `WritingHistory.tsx`

Student writing attempts history.

### Dashboard / book UI

#### `StudentDashboard.tsx`

Student home screen.

---

## 11.3 `src/components/admin` — admin UI layer

Admin presentation layer.

### Shell / navigation

* `AdminShell.tsx`
* `AdminStatsGrid.tsx`

### Lesson/content management

* `CreateLessonForm.tsx`
* `LessonsTable.tsx`
* `AddPassageForm.tsx`
* `AddQuestionForm.tsx`
* `LessonStatusToggle.tsx`
* `GenerateQuestionsButton.tsx`
* `QuestionReviewActions.tsx`
* `RegenerateQuestionButton.tsx`
* `RegenerateQuestionWithFeedback.tsx`
* `AddWritingPromptForm.tsx`
* `GenerateWritingPromptButton.tsx`
* `WritingSubmissionsList.tsx`

### Source/PDF pipeline

* `CreateSourceForm.tsx`
* `UploadPdfSourceForm.tsx`
* `GeneratePassagesButton.tsx`
* `GeneratePassagesFromCleanTextButton.tsx`
* `AnalyzePassageButton.tsx`
* `AnalyzePassageV2Button.tsx`
* `GeneratedPassageActions.tsx`
* `DetectStructureButton.tsx`
* `BuildCleanTextButton.tsx`

### Students

* `CreateStudentForm.tsx`
* `StudentsTable.tsx`
* `EditStudentForm.tsx`
* `StudentRecentLessons.tsx`
* `StudentVocabularyHistory.tsx`
* `StudentWritingHistory.tsx`

---

## 11.4 `src/lib` — infrastructure helpers

### `src/lib/supabase/server.ts`

Server-side Supabase client factory.
Used by:

* app pages
* API routes
* services

### `src/lib/auth/admin.ts`

Admin auth/session logic.
Used by:

* admin pages

### `src/lib/openai.ts`

OpenAI client initialization.
Used by:

* all AI services

---

## 11.5 `src/services` — business logic layer

This is the main domain layer of the project.
The correct principle is: UI should not know business logic; it should call services.

### `services/ai`

AI-specific logic.
Includes:

* `analyze-generated-passage-v2.ts`
* `generate-sat-questions.ts`
* `generate-vocabulary-explanations.ts`
* `generate-vocabulary-drill-options.ts`
* `generate-inline-vocabulary-preview.ts`
* `generate-word-audio.ts`
* `evaluate-short-answer.ts`
* `generate-writing-prompt.ts`
* `detect-book-structure.ts`

Responsibility:

* build prompts
* call OpenAI
* parse JSON responses
* return typed results

### `services/pdf`

PDF processing logic.
Includes:

* `extract-pdf-pages.ts`
* `build-clean-book-text.ts`

Responsibility:

* extraction
* page-level processing
* clean chapter text assembly

### `services/content`

Content shaping and retrieval.
Includes:

* `content.service.ts`
* `chapter-chunker.ts`

Responsibility:

* get published lessons
* split chapter text into pedagogical passages

### `services/lesson-state`

Lesson runtime state management.
Includes:

* `lesson-state.service.ts`

Responsibility:

* create/get student lesson state
* move between stages

### `services/reading`

Reading progression and book flow.
Includes:

* `reading.service.ts`
* `book-overview.service.ts`
* `book-progress.service.ts`

Responsibility:

* previous/next lesson
* book overview
* current reading position
* resume reading

### `services/vocabulary`

Vocabulary runtime logic.
Includes:

* `vocabulary.service.ts` (if present in current project)

Responsibility:

* update SRS state
* weak words logic
* lesson-to-vocab integration

### `services/analytics`

Analytics logic.
Includes:

* `analytics.service.ts`

Responsibility:

* average accuracy
* weak skills summary

### `services/recommendations`

Student recommendation logic.
Includes:

* `recommendations.service.ts`

Responsibility:

* next lesson
* due vocab
* current focus

### `services/progress`

Dashboard aggregation.
Includes:

* `progress.service.ts`

Responsibility:

* compose student dashboard payload

### `services/gamification`

Gamification rules.
Includes:

* `gamification.service.ts`

Responsibility:

* XP
* level
* streak
* achievements

---

## 11.6 Dependency map

### UI Pages

`app/.../page.tsx`
→ use `lib/supabase/server`
→ use `services/...`
→ render `components/...`

### Client Components

`components/student/*`, `components/admin/*`
→ call `app/api/...` routes
→ local UI state only

### API Routes

`app/api/...`
→ use `lib/supabase/server`
→ use `services/...`
→ no UI logic

### Services

`services/...`
→ may use `lib/openai`
→ may use `lib/supabase/server`
→ should not depend on React/components

### Infra

`lib/...`
→ foundational only
→ no dependency on UI or business layer

---

## 11.7 Recommended mental model for a new developer

Layer A — Pages
“Which page opens and what payload does it need?”

Layer B — Components
“Which UI logic lives in the client component?”

Layer C — API
“Which action is being called from the client?”

Layer D — Services
“Where is the real business logic?”

Layer E — Data
“Which Supabase tables are involved?”

---

## 11.8 Fast navigation cheatsheet

### If changing lesson player

Go to:

* `src/components/student/LessonPlayer.tsx`
* `src/components/student/QuestionWorkspace.tsx`
* `src/components/student/LessonProgressHud.tsx`

### If changing lesson flow/stages

Go to:

* `src/components/student/LessonStagePanel.tsx`
* `src/services/lesson-state/lesson-state.service.ts`
* `src/app/api/lesson/stage/route.ts`
* `src/app/api/lesson/advance-stage/route.ts`

### If changing interactive passage / inline vocab

Go to:

* `src/components/student/InteractivePassageReader.tsx`
* `src/app/api/vocabulary/preview-inline/route.ts`
* `src/app/api/vocabulary/capture-inline/route.ts`
* `src/app/api/vocabulary/generate-audio/route.ts`

### If changing student lesson page composition

Go to:

* `src/app/s/[code]/lesson/[lessonId]/page.tsx`

### If changing dashboard

Go to:

* `src/app/s/[code]/page.tsx`
* `src/components/student/StudentDashboard.tsx`
* `src/services/progress/progress.service.ts`

### If changing PDF pipeline

Go to:

* `src/components/admin/UploadPdfSourceForm.tsx`
* `src/app/api/admin/sources/upload-pdf/route.ts`
* `src/services/pdf/extract-pdf-pages.ts`
* `src/services/ai/detect-book-structure.ts`
* `src/app/api/admin/sources/detect-structure/route.ts`
* `src/services/pdf/build-clean-book-text.ts`
* `src/app/api/admin/sources/build-clean-text/route.ts`
* `src/services/content/chapter-chunker.ts`
* `src/app/api/admin/sources/generate-passages-from-clean-text/route.ts`

### If changing analyzer v2

Go to:

* `src/services/ai/analyze-generated-passage-v2.ts`
* `src/app/api/admin/analyze-passage-v2/route.ts`
* `src/components/admin/AnalyzePassageV2Button.tsx`

### If changing writing mode

Go to:

* `src/components/student/WritingPanel.tsx`
* `src/components/student/WritingHistory.tsx`
* `src/services/ai/evaluate-short-answer.ts`
* `src/app/api/writing/submit/route.ts`
* `src/services/ai/generate-writing-prompt.ts`
* `src/app/api/admin/writing-prompts/generate/route.ts`

### If changing student admin pages

Go to:

* `src/app/admin/students/page.tsx`
* `src/app/admin/students/[studentId]/page.tsx`
* `src/components/admin/EditStudentForm.tsx`
* `src/components/admin/StudentRecentLessons.tsx`
* `src/components/admin/StudentVocabularyHistory.tsx`
* `src/components/admin/StudentWritingHistory.tsx`

---

## 11.9 Best-practice structure going forward

Rule 1
New business logic goes into `services/`, not `page.tsx`.

Rule 2
New AI prompt gets its own file in `services/ai/`.

Rule 3
Client interactivity lives only in `components/...`.

Rule 4
API routes should remain thin:

* validate
* call service
* return result

Rule 5
Student route composition should remain in:
`src/app/s/[code]/lesson/[lessonId]/page.tsx`
but without heavy logic.

---

# 12. Update Log

## 2026-03-22

* Created initial working documentation
* Consolidated approved product structure
* Consolidated Reading Lesson Player behavior
* Consolidated source pipeline concept
* Consolidated database architecture
* Documented current weak points and approved decisions
* Added code structure and architecture interpretation

## 2026-03-22

* Created initial working documentation
* Consolidated approved product structure
* Consolidated Reading Lesson Player behavior
* Consolidated source pipeline concept
* Consolidated database architecture
* Documented current weak points and approved decisions
