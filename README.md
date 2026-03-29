# SAT Tutor

SAT Tutor is a Next.js + Supabase learning app focused on SAT Reading, guided book progress, lesson analytics, and vocabulary review.

The project currently has four major student surfaces:
- Reading lessons at `/s/[code]/lesson/[lessonId]`
- Books library and chapter-grouped book detail at `/s/[code]/book`
- Vocabulary Studio at `/s/[code]/vocabulary`
- Student dashboard at `/s/[code]`

## Current Product Shape

### Reading lessons
- Stage-based lesson flow: `first_read -> vocab_review -> second_read -> questions -> completed`
- Inline vocabulary capture inside the passage
- Vocabulary cards with audio and explanations
- Question-by-question SAT practice
- Reading analytics and per-question timing
- AI Tutor text explanation from the passage
- Mistake Brain analysis after lesson completion

### Books
- Kindle-style library page
- Featured current book
- Progress-first cards
- Single-book detail page with lessons grouped by chapter
- Reading order remains linear inside books

### Vocabulary Studio
- Queue-backed vocabulary review
- Three student modes:
  - `learn_new_words`
  - `review_weak_words`
  - `mixed_practice`
- Reusable vocab exercise shell
- Supported exercise types:
  - `meaning_match`
  - `fill_blank`
  - `context_meaning`
  - `synonym`
  - `collocation`
- Session builder and drill session builder
- Normalized attempt logging and local debug telemetry

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
- `/s/[code]/progress` — student progress page

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
- Vocab attempt persistence and word progress updates are live.
- Review queue generation is rule-based for now.
- Adaptive difficulty is not implemented yet.
- Books mode is chapter-aware in the UI, but still linear in progression.
