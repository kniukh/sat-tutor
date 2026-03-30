# SAT Tutor — Architecture

## High-Level Folder Structure

```text
src/
  app/
    admin/
    api/
    s/[code]/
    test/
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

## Layer Model

### Routes layer — `src/app`
- Server pages and API entry points
- `page.tsx` files should stay thin
- Route handlers should validate input, call services, and return JSON

### UI layer — `src/components`
- Student and admin presentation
- Client state and UI interactivity only
- No heavy business logic

### Infra layer — `src/lib`
- Supabase clients
- auth helpers
- OpenAI client setup
- environment validation

### Business logic layer — `src/services`
- Main domain layer
- Data loading, shaping, orchestration, scoring, queue generation, analytics
- Should not depend on React components

## Current Core Conventions
- Prefer typed service return objects over ad hoc page shaping.
- Student `page.tsx` files should assemble data, not contain domain logic.
- Keep Books mode linear.
- Use shared exercise shell instead of type-specific player duplication.
- Reuse `createClient` / `createServerSupabaseClient` for Supabase access.

## Important Student Routes

### `/s/[code]`
Student dashboard.

Current patterns:
- thin server page
- dashboard aggregation through progress services
- current reading and vocabulary blocks use service-shaped data
- vocabulary summary now uses review-queue-backed `ready to practice` shaping instead of surfacing legacy due-date counts as the primary student signal

### `/s/[code]/book`
Books library page.

Current shape:
- thin page
- data from [books-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/books-page.service.ts)
- Kindle-style progress-first cards
- featured current book section

### `/s/[code]/book/[sourceDocumentId]`
Single book detail page.

Current shape:
- thin page
- data from [book-detail.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/book-detail.service.ts)
- Duolingo-like lesson path grouped by chapter
- current lesson highlight
- reading order preserved

### `/s/[code]/lesson/[lessonId]`
Main reading lesson page.

Current composition:
- lesson content
- student record
- lesson state
- lesson passage
- question list
- lesson vocabulary items
- reading progress tracking

Main UI:
- [LessonStagePanel.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/LessonStagePanel.tsx)
  - mobile-first single-column lesson stages
  - full-screen reading focus during first and second read
  - passage/question/answer vocabulary capture hooks into shared vocab storage

### `/s/[code]/vocabulary`
Vocabulary Studio page.

Current shape:
- thin page
- data from [vocabulary-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-page.service.ts)
- queue-backed summary with progress-first metrics
- three explicit modes
- focused drill launcher
- inline drill player fallback on the same page
- automatic drill-preparation backfill for legacy vocab rows with missing normalized answer sets
- two conceptual phases in the same flow:
  - `priority_review`
  - `endless_continuation`

### `/s/[code]/vocabulary/drill`
Focused full-screen drill page.

Current shape:
- thin page
- data from [vocabulary-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-page.service.ts)
- reuses [VocabSessionPlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/VocabSessionPlayer.tsx) in focused mode
- hides summary chrome and keeps the drill surface to progress, question, answers, and action CTA

## Important API Routes

### Reading / lesson runtime
- `/api/lesson/stage`
- `/api/lesson/advance-stage`
- `/api/lesson/save-question-progress`
- `/api/lesson/submit`
- `/api/lesson/complete`
- `/api/reading/open-lesson`
- `/api/reading/metrics`
- `/api/question-attempt`

### Vocabulary
- `/api/vocabulary/prepare-drills`
- `/api/vocabulary/review`
- `/api/vocabulary/exercise-attempt`
- `/api/vocabulary/capture`
- `/api/vocabulary/capture-inline`
- `/api/vocabulary/preview-inline`
- `/api/vocabulary/generate-audio`
- `/api/vocabulary/generate-audio-bulk`

Current note:
- `prepare-drills` and `generate-from-captures` now thinly wrap shared vocabulary prep services instead of owning the orchestration directly
- lesson completion also triggers the same preparation pipeline in the backend

### AI
- `/api/ai/tutor`

## Student UI Architecture

### Reading lesson runtime
- [LessonStagePanel.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/LessonStagePanel.tsx)
  - stage-driven reading workflow
  - reading metrics post
  - vocab review cards
- [LessonPlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/LessonPlayer.tsx)
  - one-question-per-screen flow
  - passage recall overlay during quiz
  - per-question timing post
- [InteractivePassageReader.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/InteractivePassageReader.tsx)
  - long-press passage capture
  - known-word interactions
  - double-tap audio replay in second read
  - AI Tutor popup

### Books surfaces
- [StudentDashboard.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/StudentDashboard.tsx)
- [StudentDashboardOverview.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/StudentDashboardOverview.tsx)
- book pages under `src/app/s/[code]/book/...`

### Vocabulary surfaces
- [VocabSessionPlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/VocabSessionPlayer.tsx)
- reusable shell under `src/components/student/exercise-player/`
- dev gallery at `/test/exercise-gallery`

Current patterns:
- focused full-screen drill mode lives on `/s/[code]/vocabulary/drill`
- drill text can now long-press capture into shared vocabulary storage from answer choices and sentence fragments

## Vocab Exercise Architecture

### Central model
- [vocab-exercises.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/types/vocab-exercises.ts)

Supported exercise types:
- `meaning_match`
- `translation_match`
- `pair_match`
- `listen_match`
- `spelling_from_audio`
- `sentence_builder`
- `error_detection`
- `fill_blank`
- `context_meaning`
- `synonym`
- `collocation`

### Shared shell
- [ExercisePlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/exercise-player/ExercisePlayer.tsx)
- shared progress header
- shared footer
- shared answer-state logic
- normalized per-exercise telemetry
- focused drill rendering mode
- reusable drill long-press capture text wrapper

### Per-type renderers
- `MeaningMatchExercise`
- `ListenMatchExercise`
- `SpellingFromAudioExercise`
- `FillBlankExercise`
- `ContextMeaningExercise`
- `SynonymExercise`
- `CollocationExercise`

### Adapters and sessions
- [exercise-adapters.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/exercise-adapters.ts)
- [session-builder.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/session-builder.ts)
- [session-builder.config.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/session-builder.config.ts)
- [drill-session-builder.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/drill-session-builder.ts)
- [drill-answer-sets.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/drill-answer-sets.service.ts)
- [drill-preparation.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/drill-preparation.service.ts)

Current vocab session shaping also includes:
- adaptive word selection from `word_progress`, `review_queue`, and recent `exercise_attempts`
- adaptive difficulty profiling from accuracy, streaks, mastery, modality history, and response time
- lesson-aware source metadata carried from captured lesson vocabulary into exercise `reviewMeta`
- controlled modality progression, including audio-backed exercises when audio is ready
- end-of-session results and reusable analytics surfaces built from normalized attempt/session metadata
- stored per-drill answer sets reused across `translation_match`, `synonym`, `context_meaning`, and `collocation`
- automatic generation + normalization of new lesson vocabulary before it enters session building
- automatic backfill normalization of old vocabulary rows when a student opens Vocabulary Studio and otherwise would have `0 words ready now`
- endless continuation reuses the same adaptive selection + session builder pipeline rather than a separate practice system
- debug-friendly session metadata now carries session phase and continuation source buckets through the live session flow

## Service Architecture By Domain

### `services/reading`
Current responsibilities:
- book library payloads
- chapter-grouped book detail payloads
- lesson sequence / book progression
- reading metrics persistence

Important files:
- [books-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/books-page.service.ts)
- [book-detail.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/book-detail.service.ts)
- [book-progress.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/book-progress.service.ts)
- [reading-metrics.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/reading-metrics.service.ts)

### `services/lesson-state`
Current responsibilities:
- get/create lesson state
- stage transitions
- final lesson completion
- skill tracking hook-in
- Mistake Brain hook-in
- post-lesson vocabulary drill preparation hook

Important files:
- [lesson-state.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/lesson-state/lesson-state.service.ts)
- [complete-lesson.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/lesson-state/complete-lesson.service.ts)

### `services/analytics`
Current responsibilities:
- question timing persistence
- skill tracking
- skill dashboards
- Mistake Brain orchestration
- vocabulary analytics aggregation for student-facing progress surfaces and future teacher/admin reuse

Important files:
- [question-attempts.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/question-attempts.service.ts)
- [mistake-brain.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/mistake-brain.service.ts)
- [skill-tracking.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/skill-tracking.service.ts)
- [vocabulary-analytics.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/vocabulary-analytics.service.ts)

### `services/ai`
Current responsibilities:
- tutor explanations
- lesson mistake analysis
- question generation
- vocab card generation
- audio generation
- passage analysis
- drill answer-set generation

Important files:
- [tutor.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/tutor.service.ts)
- [analyze-lesson-mistakes.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/analyze-lesson-mistakes.ts)

### `services/vocabulary`
Current responsibilities:
- normalize exercises
- build sessions
- choose adaptive word slices and modality paths
- choose adaptive difficulty paths
- persist exercise attempts
- update `word_progress`
- generate and fetch `review_queue`
- aggregate vocabulary page data
- normalize and store reusable drill answer sets
- generate lesson vocabulary from captures
- prepare drill-ready vocab payloads for lesson completion and vocabulary APIs

Important files:
- [vocabulary-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-page.service.ts)
- [adaptive-difficulty.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/adaptive-difficulty.service.ts)
- [exercise-attempts.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/exercise-attempts.service.ts)
- [exercise-progress.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/exercise-progress.service.ts)
- [review-policy.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/review-policy.service.ts)
- [review-queue.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/review-queue.service.ts)

## Dependency Model

### Pages
`page.tsx`
-> `services/...`
-> `components/...`

### Client components
`components/...`
-> `app/api/...`
or
-> props from server pages

### API routes
`app/api/...`
-> `services/...`
-> Supabase / OpenAI helpers

### Services
`services/...`
-> Supabase helpers
-> OpenAI helper
-> typed shaping logic

## Current Dev Utilities
- `/test`
- `/test-submit`
- `/test/exercise-gallery`
- lesson reset button
- regenerate audio button
- exercise telemetry debug panels
- adaptive selection / adaptive difficulty debug summaries in Vocabulary Studio dev surfaces

## Architectural Priorities Going Forward
- Keep docs in sync with the implemented vocab architecture.
- Continue moving shaping logic out of UI into services.
- Keep adaptive logic rule-based and inspectable before introducing more AI-driven routing.
- Preserve a single reusable exercise shell as new vocab types are added.
- Keep analytics reusable across student, admin, and future teacher surfaces instead of page-local summaries.
