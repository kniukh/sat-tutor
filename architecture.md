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
- progress / competition hero reads gamification + leaderboard summary
- vocabulary summary now uses review-queue-backed `ready to practice` shaping instead of surfacing legacy due-date counts as the primary student signal
- canonical session-based dashboard now also exists at `/s`, while `/s/[code]` remains a compatibility route
- student logout clears the signed server cookie

### `/s/[code]/book`
Books library page.

Current shape:
- thin page
- data from [books-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/books-page.service.ts)
- Kindle-style progress-first cards
- featured current book section
- visible `Go to Library` CTA from the dashboard and book covers on student cards
- canonical session-based route now also exists at `/s/book`

### `/s/[code]/book/[sourceDocumentId]`
Single book detail page.

Current shape:
- thin page
- data from [book-detail.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/reading/book-detail.service.ts)
- Duolingo-like lesson path grouped by chapter
- current lesson highlight
- reading order preserved
- canonical session-based route now also exists at `/s/book/[sourceDocumentId]`

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
  - `Text | Words` toggle so reading screens can switch between the passage and the captured lesson word list
  - passage/question/answer vocabulary capture hooks into shared vocab storage
  - lesson-scoped Word Bank tray with pending/saved state
  - first-read checkpoints save pending vocabulary and move the stage forward without a submit-centric UI
  - completed stage can branch into a guided vocabulary intro before the next reading lesson
- [LessonPlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/LessonPlayer.tsx)
  - SAT-style one-question-per-screen quiz shell
  - `quiz -> quiz_words -> repair -> quiz_complete` subflow inside the question stage
  - optional `Why?` reasoning bottom sheet backed by `/api/question-explanation`
  - quiz-word cards reuse the same vocabulary card system as passage words, including targeted audio generation for quiz-only captures
  - repair retries the original SAT item directly until each missed question is answered correctly and keeps `See Passage` as a returnable helper instead of a separate reveal screen
  - canonical session-based route now also exists at `/s/lesson/[lessonId]`

### `/s/[code]/vocabulary`
Vocabulary Studio page.

Current shape:
- thin page
- data from [vocabulary-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-page.service.ts)
- queue-backed summary with progress-first metrics
- three explicit modes
- focused drill launcher
- entry point into `My Vocabulary`
- inline drill player fallback on the same page
- automatic drill-preparation backfill for legacy vocab rows with missing normalized answer sets
- two conceptual phases in the same flow:
  - `priority_review`
  - `endless_continuation`
- page load avoids blocking on heavy drill preparation; background prep and audio can happen after render
- canonical session-based route now also exists at `/s/vocabulary`

### `/s/[code]/vocabulary/list`
Student-wide vocabulary list.

Current shape:
- thin page
- data from [student-vocabulary.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/student-vocabulary.service.ts)
- search over word, definition, and translation
- reuses [VocabularyReviewCards.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/VocabularyReviewCards.tsx)
- student actions stay personal:
  - soft delete
  - regenerate definition from context
  - play audio
- canonical session-based route also exists at `/s/vocabulary/list`

### `/s/[code]/vocabulary/drill`
Focused full-screen drill page.

Current shape:
- thin page
- data from [vocabulary-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-page.service.ts)
- reuses [VocabSessionPlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/VocabSessionPlayer.tsx) in focused mode
- hides summary chrome and keeps the drill surface to progress, question, answers, and action CTA
- canonical session-based route now also exists at `/s/vocabulary/drill`

### `/s/[code]/mistake-brain`
Insights surface.

Current shape:
- thin page
- data from [mistake-brain-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/mistake-brain-page.service.ts)
- weak skills, review lists, patterns, recommendations
- optional launch point into Mistake Replay
- canonical session-based route now also exists at `/s/mistake-brain`

### `/s/[code]/mistake-replay`
Focused repair-mode route.

Current shape:
- thin page
- data from [mistake-replay.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/mistake-replay.service.ts)
- one-item-at-a-time replay player
- reuses question attempts, vocab attempts, and explanation services

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
- `/api/vocabulary/session-complete`
- `/api/vocabulary/capture`
- `/api/vocabulary/capture-inline`
- `/api/vocabulary/delete-item`
- `/api/vocabulary/preview-inline`
- `/api/vocabulary/regenerate-item-meaning`
- `/api/vocabulary/generate-audio`
- `/api/vocabulary/generate-audio-bulk`
- `/api/vocabulary/regenerate-audio`

Current note:
- `prepare-drills` and `generate-from-captures` now thinly wrap shared vocabulary prep services instead of owning the orchestration directly
- lesson completion also triggers the same preparation pipeline in the backend
- `preview-inline`, `generate-from-captures`, and `prepare-drills` use the shared `vocabulary_dictionary_cache` before AI generation
- `delete-item` and `regenerate-item-meaning` only affect the student's own vocabulary row and never delete or overwrite shared global reusable content
- `preview-inline` is no longer required just to save a selected word; lesson selection popups can add first and load meaning on demand
- `regenerate-audio` supports targeted generation for specific vocabulary item texts so quiz-only cards do not compete with the full lesson bank
- student-facing vocabulary session completion is guarded against async save/completion races

### AI
- `/api/ai/tutor`
- `/api/question-explanation`

## Student UI Architecture

### Reading lesson runtime
- [LessonStagePanel.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/LessonStagePanel.tsx)
  - stage-driven reading workflow
  - reading metrics post
  - vocab review cards
  - reading `Text | Words` toggle and guided completion bridge into vocabulary practice
- [LessonPlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/LessonPlayer.tsx)
  - one-question-per-screen flow
  - passage recall overlay during quiz
  - per-question timing post
  - optional structured reasoning explanation bottom sheet
- [InteractivePassageReader.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/InteractivePassageReader.tsx)
  - long-press passage capture
  - known-word underline interactions
  - fast second-read meaning/translation hover/tap cards
  - AI Tutor popup
- [InlineVocabularyCaptureText.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/InlineVocabularyCaptureText.tsx)
  - shared desktop text-selection + mobile long-press vocabulary capture wrapper for quiz, repair, and drills
- [LessonVocabularyTray.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/LessonVocabularyTray.tsx)
  - floating lesson Word Bank widget with pending/saved status

### Books surfaces
- [StudentDashboard.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/StudentDashboard.tsx)
- [StudentDashboardOverview.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/StudentDashboardOverview.tsx)
- book pages under `src/app/s/[code]/book/...`

### Vocabulary surfaces
- [VocabSessionPlayer.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/VocabSessionPlayer.tsx)
- [VocabularyReviewCards.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/VocabularyReviewCards.tsx)
  - shared card surface for lesson words, quiz words, and `My Vocabulary`
  - inline `Delete | Regenerate | Audio` actions
- [MyVocabularyPageClient.tsx](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/components/student/MyVocabularyPageClient.tsx)
- reusable shell under `src/components/student/exercise-player/`
- dev gallery at `/test/exercise-gallery`

Current patterns:
- focused full-screen drill mode lives on `/s/[code]/vocabulary/drill`
- drill text can now long-press capture into shared vocabulary storage from answer choices and sentence fragments
- grouped `listen_match` can render as a two-column audio-to-text matching exercise
- live drill flow is now intentionally minimal: progress, question, answer area, and one `Continue` CTA with short correctness animation
- saved-word management stays inside the same card system instead of introducing a separate vocabulary manager UI path

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

Current live-session emphasis:
- `meaning_match`
- `translation_match`
- `pair_match`
- `listen_match`
- `spelling_from_audio`
- `context_meaning`
- `synonym`

Current note:
- `fill_blank`, `sentence_builder`, `error_detection`, and `collocation` remain supported in the normalized renderer system and dev gallery, but are not part of the current live student session mix

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
- [drill-content-engine.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/drill-content-engine.service.ts)

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
- Mistake Replay session selection
- vocabulary analytics aggregation for student-facing progress surfaces and future teacher/admin reuse
- AI usage rollups for admin insights by student

Important files:
- [question-attempts.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/question-attempts.service.ts)
- [mistake-brain.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/mistake-brain.service.ts)
- [mistake-brain-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/mistake-brain-page.service.ts)
- [mistake-replay.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/mistake-replay.service.ts)
- [skill-tracking.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/skill-tracking.service.ts)
- [vocabulary-analytics.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/vocabulary-analytics.service.ts)
- [ai-usage-by-student.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/analytics/ai-usage-by-student.service.ts)

### `services/ai`
Current responsibilities:
- tutor explanations
- structured reasoning explanations for reading questions
- lesson mistake analysis
- question generation
- vocab card generation
- audio generation
- passage analysis
- drill answer-set generation
- AI usage logging with optional `student_id` ownership
- prompt routing and validation for admin SAT question generation
- chunk-level generation cache and short regenerate context windows

Important files:
- [tutor.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/tutor.service.ts)
- [generate-question-reasoning-explanation.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/generate-question-reasoning-explanation.ts)
- [analyze-lesson-mistakes.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/analyze-lesson-mistakes.ts)
- [admin-question-prompt-router.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/admin-question-prompt-router.ts)
- [question-quality.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/question-quality.ts)
- [chunk-generation-cache.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/chunk-generation-cache.ts)
- [openai-tracked-response.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/openai-tracked-response.ts)
- [ai-usage-log.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/ai/ai-usage-log.service.ts)

### `services/gamification`
Current responsibilities:
- XP policy and award ledger
- student gamification snapshot shaping
- weekly leaderboard groups and ranking

Important files:
- [xp-policy.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/gamification/xp-policy.service.ts)
- [xp-awards.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/gamification/xp-awards.service.ts)
- [leaderboards.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/gamification/leaderboards.service.ts)

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
- keep reusable global word/drill content in a shared cache keyed by lemma/profile
- materialize student-specific vocabulary rows from shared content without duplicating global AI content
- generate lesson vocabulary from captures
- prepare drill-ready vocab payloads for lesson completion and vocabulary APIs
- reuse shared dictionary cache entries across students before AI fallback
- support student-specific soft delete and context-regenerated overrides without overwriting global reusable content
- deduplicate inline preview requests with client/server cache

Important files:
- [vocabulary-page.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-page.service.ts)
- [adaptive-difficulty.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/adaptive-difficulty.service.ts)
- [exercise-attempts.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/exercise-attempts.service.ts)
- [exercise-progress.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/exercise-progress.service.ts)
- [review-policy.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/review-policy.service.ts)
- [review-queue.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/review-queue.service.ts)
- [vocabulary-dictionary-cache.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-dictionary-cache.service.ts)
- [drill-content-engine.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/drill-content-engine.service.ts)
- [student-vocabulary.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/student-vocabulary.service.ts)
- [vocabulary-item-overrides.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/vocabulary-item-overrides.ts)
- [inline-preview-cache.client.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/inline-preview-cache.client.ts)
- [inline-preview-cache.server.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/inline-preview-cache.server.ts)

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
- Continue replacing legacy `/s/[code]/...` client assumptions with session-cookie-based APIs and canonical `/s/...` links.
