# SAT Tutor — Project Overview

## Product Summary
SAT Tutor is a student learning app centered on SAT Reading with three connected product loops:
- read and complete lessons
- continue through books without breaking reading order
- reinforce vocabulary through queue-backed review sessions

The current implementation focus is still SAT Reading. Writing exists as a lesson feature, but SAT Math and a broader subject framework are not the priority yet.

## Current Student Product Areas

### 1. Dashboard
Student home with:
- current reading
- vocabulary launchpad
- XP / level / streak / leaderboard rank
- subtle links into Insights and replay

### 2. Books
Books are now a distinct student experience:
- Books library page
- featured current book
- per-book progress cards
- chapter-grouped book detail page
- large Continue Reading CTA
- visible `Go to Library` secondary CTA and cover art on student reading cards

Books remain linear by product decision.

### 3. Reading lessons
Stage-based reading flow:
- `first_read`
- `vocab_review`
- `second_read`
- `questions`
- `completed`

Key current capabilities:
- mobile-first reading flow with full-width passage focus
- long-press vocabulary capture on mobile and text-selection capture on desktop
- shared floating `Word Bank` tray across first read, second read, quiz, repair, and drills
- vocabulary card review with paged mobile-friendly cards
- second-read hover/tap meaning + translation popups on saved words
- AI Tutor explanation on text selection
- optional coaching-style question explanations in a bottom sheet
- SAT-style repair that retries the original question and does not expose the correct answer immediately after a mistake
- reading speed telemetry
- per-question timing
- post-lesson Mistake Brain analysis
- Mistake Replay entry point after completion

### 4. Vocabulary Studio
Separate review surface from lesson runtime.

Current modes:
- `learn_new_words`
- `review_weak_words`
- `mixed_practice`
- focused drill route at `/s/[code]/vocabulary/drill`
- Mistake Replay route at `/s/[code]/mistake-replay`

Current foundations:
- normalized vocab exercise model
- reusable exercise shell
- session builder
- review queue
- word progress lifecycle
- exercise attempt logging
- adaptive difficulty v1
- end-of-session results
- vocabulary analytics summaries
- lesson-to-vocabulary bridge through captured lesson words and source-aware session shaping
- shared DB-first dictionary cache for fast meaning/translation and reusable distractors/answer sets
- stored normalized drill answer sets
- automatic drill preparation after reading completion
- long-press capture inside drill sessions
- two-phase endless practice:
  - `priority_review`
  - `endless_continuation`
- progress-first top metrics:
  - `Captured`
  - `Mastered`
  - `Practiced today`
- replay-oriented results actions:
  - `Replay Mistakes`
  - `View your weak areas`
- audio-backed modalities:
  - `listen_match`
  - `spelling_from_audio`
- grouped two-column `listen_match` pairs when enough audio-ready items exist
- higher-variety drills:
  - `translation_match`
  - `pair_match`
  - `sentence_builder`
  - `error_detection`

## Current Product Decisions

### Books
- Do not break reading order.
- Adapt around the book instead of rerouting inside the book.
- Use chapter grouping in the UI because books are loaded by chapters.

### Vocabulary
- Review should be session-based, not a flat random list.
- Start with transparent rule-based scheduling before heavier adaptive systems.
- Keep a reusable exercise shell so new vocab modalities do not create new players.
- Keep lesson-derived words connected to their original reading context when they reappear in Vocabulary Studio.
- Keep distractor generation and correct-answer shaping reusable at the data layer, not inside individual UIs.
- Let drill capture reuse the same storage model as lesson capture instead of creating a second vocabulary inbox.
- Prefer cache-first dictionary lookup before AI fallback for shared meanings, translations, distractors, and answer sets.
- Keep due logic internal and important for prioritization, but do not make it the dominant student-facing goal.
- Let practice continue through the same adaptive pipeline after the first priority checkpoint rather than ending at the due boundary.

### Analytics
- Collect structured telemetry before adding more adaptation.
- Save enough detail to explain performance later:
  - reading duration
  - question timing
  - per-exercise vocab attempts
  - mistake analysis
- Use that telemetry to build short repair loops, not static mistake lists.
- Keep session completion resilient to client/server timing races so XP and result screens do not depend on fragile request ordering.

## Current Implemented Highlights

### Reading runtime
- inline long-press vocabulary capture from passage text
- source-aware vocabulary capture from quiz question and answer text
- known-word underline and hover interactions
- vocabulary cards with meaning + translation review and background-friendly enrichment
- second-read hover/tap vocabulary review on saved words
- reading metrics API and persistence
- per-question timing API and persistence
- AI Tutor popup for selected text

### Lesson completion analytics
- lesson attempt creation
- skill tracking updates
- Mistake Brain post-processing
- automatic vocabulary drill preparation for newly captured lesson words
- Mistake Replay can later pull recent incorrect reading questions back into a short retry session

### Books UX
- Kindle-style books library
- chapter-grouped book detail path
- current lesson highlighting
- Continue Reading CTA

### Vocabulary UX and architecture
- queue-backed summary buckets
- learn/review/mixed mode switch
- focused full-screen drill mode
- inline drill player on the main Vocabulary Studio page
- queue-aware session composition
- lesson-aware session composition for fresh words from recent reading lessons
- audio preparation and audio-aware session inclusion
- dev exercise gallery for all exercise types
- normalized attempt telemetry and shared debug panels
- drill-time long-press vocabulary capture from answers, distractors, and sentence fragments
- Word Bank tray shows `Pending / Saved` states and checkpoint-saves pending items
- progress-first student dashboard and Vocabulary Studio entry points built around `Start Practice`, `Continue Practice`, and `Review Weak Words`
- short Mistake Replay repair sessions built from recent incorrect reading and vocabulary attempts

### Gamification
- XP rewards reading answers, vocab attempts, and session completion
- anti-abuse guardrails reduce farming from repeated words and micro-sessions
- weekly leaderboard uses small competitive groups with weekly reset

### Admin content system
- Admin is split into structured sections:
  - `Students`
  - `Insights`
  - `Content`
  - `Sources`
- Source creation is unified for:
  - books
  - articles
  - poems
- Lesson review is inline and chunk-based rather than modal/JSON-based
- Content Pipeline now supports `Redo Chunks`, `Refresh Cover`, `Approve All`, and `Publish Approved`
- admin lessons can be deleted with linked runtime/content cleanup

## What “Adaptive” Means Right Now

Current adaptation is rule-based, not fully AI-driven.

Implemented today:
- `word_progress` lifecycle updates
- `review_queue` generation
- queue bucket prioritization
- bucket-aware session building
- endless continuation using the same adaptive selection + session builder pipeline
- rule-based adaptive difficulty using mastery, streaks, modality history, and response time
- lesson-connected source metadata and beginner-friendly lesson word progression
- audio modalities inside the same reusable exercise player
- end-of-session results loop for Vocabulary Studio
- Vocabulary Analytics v1 for dashboard and progress surfaces
- Mistake Brain classification

Not implemented yet:
- dynamic modality switching driven by long-term modeling
- adaptive next-lesson routing inside Books
- richer teacher/admin-facing vocabulary analytics surfaces

## Current Risks / Constraints
- Vocab scheduling is intentionally simple and explainable for now.
- Legacy compatibility fields still exist in parts of the vocab model.
- Books mode should resist “smart” rerouting that breaks book continuity.
- Some student lesson page composition is still heavier than ideal and can be service-extracted further later.

## Current Working Direction
- Stabilize the reusable vocab exercise system.
- Grow review scheduling from transparent rules to smarter policies.
- Grow vocabulary analytics from practical summaries into teacher/admin insight surfaces.
- Keep Books polished and chapter-aware without sacrificing linearity.
- Keep telemetry rich enough to support future personalization without rewriting the current foundations.
- Continue consolidating student navigation and APIs around server sessions and canonical `/s/...` routes.
