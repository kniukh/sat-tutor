# Vocabulary Session Policy

## Philosophy

Vocabulary sessions now use a touch-based builder instead of a mostly one-touch-per-word sequence.

The session builder separates:

- `anchor words`: the main words selected for the session.
- `support words`: extra words that may appear inside grouped pair/listen drills.
- `touches`: meaningful interactions with a word. Single-word exercises count as one touch for the target word. Grouped drills count one support interaction for each word represented in the pair set.

This keeps sessions longer and more useful without turning them into random exercise spam. New or fragile words should be seen more than once, while grouped drills reinforce a cluster without replacing direct anchor-word learning.

## Learning Families

The builder enforces variety by learning family rather than by forcing every exercise type.

- `Recognition`: `meaning_match`, `translation_match`
- `Audio/Form`: single-word `listen_match`, `spelling_from_audio`
- `Context/Semantic`: `context_meaning`, `synonym`, plus legacy contextual types if present
- `Grouped Support`: `pair_match` and grouped `listen_match` exercises with multiple pair targets

Grouped support exercises are intentionally scheduled after anchor primary/reinforcement passes. They should reinforce the session, not become the only meaningful exposure for critical words.

## Per-Mode Rules

`learn_new_words`

- Targets 5-6 anchor words when the pool allows it.
- Gives every anchor word a primary touch.
- Attempts a second touch for every anchor word.
- Gives up to two highest-risk anchors a third touch.
- Allows up to two grouped support drills.

`review_weak_words`

- Targets 7-8 anchor words when the pool allows it.
- Gives every anchor word a primary touch.
- Gives top weak/risky words a second corrective touch.
- Allows a small grouped support budget.

`mixed_practice`

- Targets 7-8 anchor words when the pool allows it.
- Keeps most words at one direct touch.
- Adds a small reinforcement budget for the highest-priority anchors.
- Adds limited grouped support.

Legacy modes (`default_review`, `weak_first`, `mixed`) map to the same policy family so older entry points still work.

## Builder Passes

1. `Pass 1: anchor primary`

   Selects anchor words and gives each one a direct, non-grouped exercise. Recognition is preferred first, then audio/form or context/semantic depending on mode and availability.

2. `Pass 2: anchor reinforcement`

   Revisits selected anchors using a different family where possible. Spelling may repeat more than other exercise types, but it is capped per session.

3. `Pass 3: grouped support`

   Adds a limited number of grouped pair/listen drills. These can include both anchor and support words, but they are not allowed to replace the direct anchor passes.

4. `Fallback`

   If a pool lacks direct anchor-ready exercises, the builder can fall back to the best available exercise so the player does not break.

## Retry Behavior

Client-side retry remains conservative:

- `pair_match` and grouped `listen_match` are not auto-queued for retry.
- Eligible single-word misses prefer a different exercise type for the same word if one already exists in the session.
- If no corrective follow-up is available, the player falls back to repeating the missed exercise.

This avoids frustrating grouped retries while giving missed single words a better corrective second look.

## Metadata

The session metadata now includes touch-policy counters:

- `anchor_word_target`: intended anchor count for the mode/pool.
- `anchor_word_count`: number of anchor words actually selected.
- `support_word_count`: non-anchor words that appeared through grouped support drills.
- `words_seen_once`: anchor words with exactly one touch.
- `words_seen_twice`: anchor words with exactly two touches.
- `words_seen_three_plus`: anchor words with three or more touches.
- `total_interactions`: total word-level interactions, where grouped drills count each represented word.
- `reinforcement_budget`: allowed anchor reinforcement touches for the mode.
- `grouped_support_budget`: allowed grouped support exercises for the mode.

Each `sequence_debug` row also includes:

- `session_role`: primary, reinforcement, risk reinforcement, grouped support, or fallback.
- `learning_family`: recognition, audio/form, context/semantic, or grouped support.
- `touch_number`: the target word's touch number after the exercise.
- `grouped_support_word_ids`: covered word ids for grouped support rows.

These fields make the session explainable in dev summaries and future analytics without changing the exercise player contract.
