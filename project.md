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
- recent lessons
- weakest skills
- due vocabulary
- XP / level / streak

### 2. Books
Books are now a distinct student experience:
- Books library page
- featured current book
- per-book progress cards
- chapter-grouped book detail page
- large Continue Reading CTA

Books remain linear by product decision.

### 3. Reading lessons
Stage-based reading flow:
- `first_read`
- `vocab_review`
- `second_read`
- `questions`
- `completed`

Key current capabilities:
- inline vocabulary capture
- vocabulary card review
- AI Tutor explanation on text selection
- question explanations
- reading speed telemetry
- per-question timing
- post-lesson Mistake Brain analysis

### 4. Vocabulary Studio
Separate review surface from lesson runtime.

Current modes:
- `learn_new_words`
- `review_weak_words`
- `mixed_practice`

Current foundations:
- normalized vocab exercise model
- reusable exercise shell
- session builder
- review queue
- word progress lifecycle
- exercise attempt logging
- lesson-to-vocabulary bridge through captured lesson words and source-aware session shaping
- audio-backed modalities:
  - `listen_match`
  - `spelling_from_audio`

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

### Analytics
- Collect structured telemetry before adding more adaptation.
- Save enough detail to explain performance later:
  - reading duration
  - question timing
  - per-exercise vocab attempts
  - mistake analysis

## Current Implemented Highlights

### Reading runtime
- inline vocabulary capture from passage text
- known-word underline and hover interactions
- vocabulary cards with audio
- reading metrics API and persistence
- per-question timing API and persistence
- AI Tutor popup for selected text

### Lesson completion analytics
- lesson attempt creation
- skill tracking updates
- Mistake Brain post-processing

### Books UX
- Kindle-style books library
- chapter-grouped book detail path
- current lesson highlighting
- Continue Reading CTA

### Vocabulary UX and architecture
- queue-backed summary buckets
- learn/review/mixed mode switch
- queue-aware session composition
- lesson-aware session composition for fresh words from recent reading lessons
- audio preparation and audio-aware session inclusion
- dev exercise gallery for all exercise types
- normalized attempt telemetry and shared debug panels

## What “Adaptive” Means Right Now

Current adaptation is rule-based, not fully AI-driven.

Implemented today:
- `word_progress` lifecycle updates
- `review_queue` generation
- queue bucket prioritization
- bucket-aware session building
- lesson-connected source metadata and beginner-friendly lesson word progression
- audio modalities inside the same reusable exercise player
- Mistake Brain classification

Not implemented yet:
- true adaptive difficulty routing
- dynamic modality switching driven by long-term modeling
- adaptive next-lesson routing inside Books

## Current Risks / Constraints
- Vocab scheduling is intentionally simple and explainable for now.
- Legacy compatibility fields still exist in parts of the vocab model.
- Books mode should resist “smart” rerouting that breaks book continuity.
- Some student lesson page composition is still heavier than ideal and can be service-extracted further later.

## Current Working Direction
- Stabilize the reusable vocab exercise system.
- Grow review scheduling from transparent rules to smarter policies.
- Keep Books polished and chapter-aware without sacrificing linearity.
- Keep telemetry rich enough to support future personalization without rewriting the current foundations.
