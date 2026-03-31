# SAT Tutor

SAT Tutor is a Next.js + Supabase learning app focused on SAT Reading, guided book progress, lesson analytics, and vocabulary review.

The project currently has four major student surfaces:
- Reading lessons at `/s/[code]/lesson/[lessonId]`
- Books library and chapter-grouped book detail at `/s/[code]/book`
- Vocabulary Studio at `/s/[code]/vocabulary`
- Focused vocabulary drill mode at `/s/[code]/vocabulary/drill`
- Student dashboard at `/s/[code]`
- Insights at `/s/[code]/mistake-brain`
- Mistake Replay at `/s/[code]/mistake-replay`

## Current Product Shape

### Reading lessons
- Stage-based lesson flow: `first_read -> vocab_review -> second_read -> questions -> completed`
- Mobile-first reading layout with no split view during reading
- Long-press vocabulary capture inside the passage
- Vocabulary cards with audio and explanations
- Second-read audio replay on saved words
- Question-by-question SAT practice with passage recall
- Optional post-answer reasoning explanations in a bottom sheet during quiz
- Reading analytics and per-question timing
- AI Tutor text explanation from the passage
- Mistake Brain analysis after lesson completion
- Mistake Replay repair sessions built from recent reading and vocabulary mistakes
- Automatic vocabulary drill preparation after lesson completion

### Books
- Kindle-style library page
- Featured current book
- Progress-first cards
- Single-book detail page with lessons grouped by chapter
- Reading order remains linear inside books

### Vocabulary Studio
- Queue-backed vocabulary review
- Lesson-connected fresh vocabulary from reading sessions
- Dedicated focused drill route for full-screen practice
- Inline drill player on the main Vocabulary Studio page
- Three student modes:
  - `learn_new_words`
  - `review_weak_words`
  - `mixed_practice`
- Reusable vocab exercise shell
- Supported exercise types:
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
- Session builder and drill session builder
- Controlled mixed sequencing with rule-based modality progression
- Rule-based adaptive difficulty with `easy`, `medium`, and `hard` session lanes
- Source-aware session shaping for lesson-derived words
- Stored normalized answer sets per drill type with explicit `drill_correct_answer` and distractors
- Automatic drill preparation pipeline for new lesson captures
- Auto-backfill drill preparation for older vocabulary rows when a student opens Vocabulary Studio with legacy items that are not drill-ready yet
- Long-press vocabulary capture inside drills from answers, distractors, and sentence fragments
- Normalized attempt logging and local debug telemetry
- End-of-session results with weak-word and recovery summaries
- Replay Mistakes entry points from session results and Insights
- Vocabulary Analytics v1 on student progress and dashboard surfaces
- Two-phase endless vocab flow:
  - `priority_review`
  - `endless_continuation`
- Progress-first student metrics:
  - `Captured`
  - `Mastered`
  - `Practiced today`
- Review queue stays internal, while UI emphasizes `words ready now`, `Start Practice`, `Continue Practice`, and `Review Weak Words`
- Weekly XP leaderboard in small groups with XP, level, streak, and rank
- Mistake Replay sessions that repair recent reading and vocabulary mistakes in short runs

### Progress, competition, and insights
- XP for reading questions, vocab exercises, and session completion
- Anti-abuse XP policy with per-word/session caps and moderated bonuses
- Weekly leaderboard groups that reset each week
- Mistake Brain as the deep insight layer for weak skills, review lists, patterns, and recommendations
- Mistake Replay as a short repair mode built from recent mistakes

### Admin surfaces
- Admin overview at `/admin`
- Structured admin sections:
  - `/admin/students`
  - `/admin/insights`
  - `/admin/content` via lessons/content review
  - `/admin/sources`
- Unified source creation for books, articles, and poems
- Inline lesson review for generated chunks and questions

## Tech Stack
- Next.js 16
- React 19
- TypeScript
- Supabase
- OpenAI
- Tailwind CSS 4

## Local Setup

### 1. Install
```bash
npm install
```

### 2. Required environment variables
Create `.env.local` with:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Environment validation lives in [env.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/lib/env.ts).

### 3. Run
```bash
npm run dev
```

### 4. Build check
```bash
npm run build
```

## Common Commands
- `npm run dev`
- `npm run build`
- `npm run lint`

## Current Architecture Rules
- Keep `page.tsx` files thin.
- Put business logic in `src/services`.
- Keep API routes thin and orchestration-only.
- Reuse existing Supabase client helpers:
  - [server.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/lib/supabase/server.ts)
  - [client.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/lib/supabase/client.ts)
- Do not break linear book order.
- Prefer explicit typed mapping between DB rows and UI payloads.

## Important Student Routes
- `/s/[code]` — dashboard
- `/s/[code]/book` — books library
- `/s/[code]/book/[sourceDocumentId]` — single book detail
- `/s/[code]/lesson/[lessonId]` — reading lesson flow
- `/s/[code]/vocabulary` — vocabulary studio
- `/s/[code]/vocabulary/drill` — focused full-screen drill session
- `/s/[code]/progress` — student progress page
- `/s/[code]/mistake-brain` — insights and weak-area analysis
- `/s/[code]/mistake-replay` — focused repair session for recent mistakes

## Important Dev / Test Routes
- `/test`
- `/test/exercise-gallery`

The exercise gallery is useful for quickly previewing all vocab exercise types with `single`, `sequence`, and `loop first item` modes.

## Important Service Areas
- `src/services/reading`
  - books page
  - book detail
  - book progress
  - reading metrics
- `src/services/lesson-state`
  - stage progression
  - lesson completion
- `src/services/analytics`
  - skill tracking
  - question timing
  - Mistake Brain
  - Mistake Replay
- `src/services/vocabulary`
  - adapters
  - session building
  - exercise attempts
  - word progress
  - review queue
  - vocabulary page aggregation
- `src/services/ai`
  - tutor
  - passage analysis
  - vocabulary generation
  - mistake analysis

## Documentation Map
- [architecture.md](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/architecture.md)
- [db.md](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/db.md)
- [project.md](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/project.md)
- [lesson-flow.md](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/lesson-flow.md)

## Current State Notes
- Reading analytics, question timing, Mistake Brain, and vocab telemetry are implemented.
- Mistake Replay now turns recent reading and vocabulary mistakes into short repair sessions.
- Vocab attempt persistence and word progress updates are live.
- Review queue generation is rule-based for now.
- Lesson-derived vocabulary now carries source lesson/context metadata into Vocabulary Studio sessions.
- Reading lessons can now capture vocabulary from passage, question text, and answer text with source-aware metadata.
- Vocabulary drills can now capture words from answer choices, distractors, and sentence fragments with `vocab_drill` source metadata.
- Audio-backed vocab practice now includes `listen_match` and `spelling_from_audio`.
- Matching and SAT-style language drills now include `pair_match`, `sentence_builder`, and `error_detection`.
- Adaptive difficulty v1 is implemented as a transparent rule-based layer in the session pipeline.
- Vocabulary Analytics v1 is implemented for exercise totals, accuracy breakdowns, weak words, lifecycle distribution, and recent vocab sessions.
- Vocabulary drill preparation is now automatic after lesson completion and reused by the existing vocabulary APIs.
- Vocabulary Studio now auto-prepares older non-ready vocab rows when needed, so existing students can still get a drill session without a manual prepare step.
- Vocabulary Studio and dashboard metrics now lead with progress rather than due counts, while review queue logic remains active internally.
- Endless vocab practice now continues past the initial priority review phase using the same adaptive/session pipeline instead of a separate system.
- XP and weekly leaderboard groups now sit on top of the existing attempt/session flows.
- Admin content creation now supports books, articles, and poems in one source pipeline with inline lesson review.
- Recent vocab changes used migrations on existing tables rather than introducing brand-new tables.
- Books mode is chapter-aware in the UI, but still linear in progression.
