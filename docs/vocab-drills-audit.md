# Vocabulary Drills Audit

Date: 2026-04-13

This document audits the current Vocabulary Drills content pipeline and session pipeline as implemented in the SAT Tutor repository. It focuses on the code paths that currently drive drill generation, shared content hydration, adaptive word selection, session assembly, and retry behavior.

## 1. Pipeline Map

### Source files

- `src/app/api/vocabulary/capture/route.ts`
- `src/app/api/vocabulary/capture-inline/route.ts`
- `src/app/api/vocabulary/generate-from-captures/route.ts`
- `src/app/api/vocabulary/prepare-drills/route.ts`
- `src/app/s/[code]/vocabulary/page.tsx`
- `src/app/s/[code]/vocabulary/drill/page.tsx`
- `src/services/vocabulary/vocabulary-capture.service.ts`
- `src/services/vocabulary/vocabulary-normalization.service.ts`
- `src/services/vocabulary/drill-preparation.service.ts`
- `src/services/vocabulary/drill-content-engine.service.ts`
- `src/services/vocabulary/vocabulary-dictionary-cache.service.ts`
- `src/services/vocabulary/drill-answer-sets.service.ts`
- `src/services/vocabulary/distractor-quality.service.ts`
- `src/services/ai/generate-vocabulary-cards.ts`
- `src/services/ai/generate-vocabulary-drill-answer-sets.ts`
- `src/services/vocabulary/vocabulary-page.service.ts`
- `src/services/vocabulary/adaptive-session-selection.service.ts`
- `src/services/vocabulary/session-builder.ts`
- `src/services/vocabulary/session-builder.config.ts`
- `src/services/vocabulary/exercise-adapters.ts`
- `src/components/student/VocabSessionPlayer.tsx`
- `src/components/student/exercise-player/ExercisePlayer.tsx`
- `src/services/vocabulary/exercise-progress.service.ts`
- `src/services/vocabulary/review-queue.service.ts`
- `src/services/vocabulary/vocab-session.service.ts`

### Main functions and execution order

#### A. Capture and normalization

1. `POST /api/vocabulary/capture` and `POST /api/vocabulary/capture-inline`
2. `recordVocabularyCaptures(...)` in `vocabulary-capture.service.ts`
3. `resolveVocabularyLemma(...)` in `vocabulary-normalization.service.ts`
4. Inserts rows into `vocabulary_capture_events`
5. Aggregates same-lemma captures with `aggregateVocabularyCaptureRows(...)`
6. Updates `word_progress` capture stats through `syncWordProgressCaptureStats(...)`

#### B. Student item materialization from captures

1. `POST /api/vocabulary/generate-from-captures`
2. `generateVocabularyItemsFromCaptures(...)` in `drill-preparation.service.ts`
3. Reads capture history from `vocabulary_capture_events`
4. Aggregates captures by canonical lemma
5. Reads existing student rows from `vocabulary_item_details`
6. Calls `ensureReusableVocabularyContent(...)` in `drill-content-engine.service.ts`
7. `ensureReusableVocabularyContent(...)`:
   - checks shared rows in `vocabulary_dictionary_cache`
   - batch-generates missing global content with `generateVocabularyCards(...)`
   - batch-generates distractors with `prepareVocabularyDistractorsBatch(...)`
   - batch-generates answer sets with `prepareVocabularyDrillAnswerSetsBatch(...)`
   - upserts global content back into `vocabulary_dictionary_cache`
8. Writes or updates student rows in `vocabulary_item_details`
9. Optionally generates student-row audio with `ensureVocabularyAudio(...)`
10. Rehydrates student rows from the shared cache with `hydrateVocabularyDetailsWithGlobalContent(...)`

#### C. Drill asset preparation for existing student items

1. `POST /api/vocabulary/prepare-drills`
2. `prepareVocabularyDrillsForStudent(...)` in `drill-preparation.service.ts`
3. Reads student rows from `vocabulary_item_details`
4. Calls `ensureReusableVocabularyContent(... includeDrillAssets: true)`
5. Updates each student row with shared `global_content_id`, explanations, distractors, and `drill_answer_sets`
6. Rehydrates rows from `vocabulary_dictionary_cache`

#### D. Vocabulary session assembly

1. `src/app/s/[code]/vocabulary/drill/page.tsx`
2. Calls `getStudentVocabularyPageData(...)` in `vocabulary-page.service.ts`
3. Reads:
   - `vocabulary_item_details`
   - `word_progress`
   - `review_queue`
   - `exercise_attempts`
4. Rehydrates student rows from shared cache via `hydrateVocabularyDetailsWithGlobalContent(...)`
5. Converts rows to `DrillItem` via `toDrillItem(...)`
6. Builds candidate exercise pool with `buildExercisePoolFromDrillItems(...)`
7. Groups exercises by target word and builds adaptive word candidates
8. Chooses which words enter the session with `selectAdaptiveSessionExercises(...)`
9. Attaches adaptive metadata back to exercises with `attachAdaptiveSelectionMeta(...)`
10. Builds final ordered session with `buildVocabExerciseSession(...)`
11. Renders in `VocabSessionPlayer` -> `ExercisePlayer`

#### E. Attempt persistence and review state

1. `ExercisePlayer` emits `ExerciseResult`
2. `VocabSessionPlayer` persists attempts via `persistExerciseAttempt(...)`
3. `applyExerciseAttemptToProgress(...)` in `exercise-progress.service.ts`
4. Updates `word_progress`
5. Ensures session row in `vocab_sessions`
6. Syncs next review item via `syncReviewQueueForWordProgress(...)`

## 2. Exercise Inventory

### Live now

These exercise types are actually emitted by `buildExercisePoolFromDrillItems(...)` and can enter sessions.

| Exercise type | Current live variants |
|---|---|
| `meaning_match` | base definition, alternate definition variant |
| `translation_match` | `english_to_native`, `native_to_english` |
| `pair_match` | `word_definition`, `english_native` |
| `listen_match` | grouped `translation`, grouped `english`, grouped `meaning`, single fallback `translation` or `meaning` |
| `spelling_from_audio` | single-word listen-and-type |
| `context_meaning` | sentence meaning in context |
| `synonym` | synonym, plus antonym variant when antonym candidates exist |

### Implemented but not live

These have adapters and renderers but are not currently included in the live pool returned by `buildExercisePoolFromDrillItems(...)`.

| Exercise type | Status |
|---|---|
| `fill_blank` | implemented, not emitted into live pool |
| `sentence_builder` | implemented, not emitted into live pool |
| `error_detection` | implemented, not emitted into live pool |
| `collocation` | implemented, not emitted into live pool |

### Partially supported, dead code, or fallback-only

| Item | Current state |
|---|---|
| `pair_match.native_english` | supported in types, not generated by adapters |
| `pair_match.synonym_pair` | supported in types, not generated by adapters |
| `pair_match.collocation_pair` | supported in types, not generated by adapters |
| single `listen_match.english` | grouped-only path exists; single-item fallback does not generate English-word variant |
| `drill-session-builder.buildClozeDrillSession(...)` | helper path, not the main student Vocabulary Studio pipeline |
| `SESSION_DEFAULT_DIFFICULTY_BY_TYPE` entries for dormant types | config exists, but live pool does not emit those types |

## 3. Content Schema Inventory

### Current stored fields

#### `vocabulary_capture_events`

Relevant fields used by the drill pipeline:

- `student_id`
- `lesson_id`
- `passage_id`
- `item_text`
- `item_type`
- `context_text`
- `source_type`
- `metadata.preview.plainEnglishMeaning`
- `metadata.preview.translation`
- `metadata.preview.contextMeaning`
- `canonical_lemma`
- `captured_surface_form`
- `created_at`

#### `vocabulary_item_details`

Student-specific materialized vocabulary rows:

- `id`
- `student_id`
- `lesson_id`
- `global_content_id`
- `item_text`
- `item_type`
- `canonical_lemma`
- `captured_surface_forms`
- `capture_count`
- `first_captured_at`
- `last_captured_at`
- `english_explanation`
- `translated_explanation`
- `translation_language`
- `example_text`
- `context_sentence`
- `distractors`
- `drill_answer_sets`
- `audio_url`
- `audio_status`
- `is_removed`
- `removed_at`
- `student_definition_override`
- `student_translation_override`
- `definition_override_generated_from_context`
- `definition_override_updated_at`
- `created_at`

#### `vocabulary_dictionary_cache`

Global reusable content layer keyed by lemma/profile:

- `id`
- `normalized_item_text`
- `item_text`
- `item_type`
- `canonical_lemma`
- `source_language`
- `translation_language`
- `content_profile`
- `english_explanation`
- `translated_explanation`
- `example_text`
- `distractors`
- `drill_answer_sets`
- `alternate_definitions`
- `synonym_candidates`
- `antonym_candidates`
- `example_sentences`
- `collocations`
- `confusion_pairs`
- `drill_ingredients`
- `source_quality`
- `usage_count`
- `generation_version`
- `prompt_version`
- `generation_model`
- `refreshed_at`
- `quality_score`

#### `word_progress`

Student-specific mastery and review state:

- `word_id`
- `canonical_lemma`
- `status`
- `lifecycle_state`
- `current_difficulty_band`
- `mastery_score`
- `captured_surface_forms`
- `capture_count`
- `first_captured_at`
- `last_captured_at`
- `sessions_seen_count`
- `sessions_correct_count`
- `total_attempts`
- `correct_attempts`
- `times_seen`
- `times_correct`
- `times_wrong`
- `next_review_at`
- `next_review_session_index`
- `last_modality`
- `metadata`

#### Other session tables involved

- `review_queue`
- `exercise_attempts`
- `vocab_sessions`
- `students.native_language`

### Generated fields

#### Generated by `generateVocabularyCards(...)`

- `english_explanation`
- `translated_explanation`
- `example_text`

#### Generated by `prepareVocabularyDistractorsBatch(...)`

- `distractors`

#### Generated by `prepareVocabularyDrillAnswerSetsBatch(...)`

Within `drill_answer_sets`:

- `translation_english_to_native`
- `translation_native_to_english`
- `synonym`
- `context_meaning`
- `collocation`

Within `drill_answer_sets.__meta__`:

- `refined_definition`
- `alternate_definitions`
- `context_explanation`
- `practice_example_sentence`
- `synonym_candidates`
- `antonym_candidates`
- `collocation_candidates`
- `confusion_pairs`
- `enriched_at`

#### Generated by `buildReusableDrillIngredients(...)`

Within `vocabulary_dictionary_cache.drill_ingredients`:

- `supported_types`
- `primary_practice_sentence`
- `alternate_definitions`
- `synonym_candidates`
- `antonym_candidates`
- `collocation_candidates`
- `confusion_pairs`
- `translation_variants`
- `context_variant`
- `collocation_variant`
- `target_item_text`

### Missing fields

- No dedicated `translation_word` or other schema-level field for a single lexical translation.
- No dedicated `core_meaning` field separate from `english_explanation`.
- No stored sense identifier or sense family for disambiguating multiple meanings.
- No explicit per-item `practice_sentence_source` column; source is only implied in metadata.
- No global audio field in the reusable content layer.
- No stored grouped-drill-ready asset tables or pair bundles; grouped drills are assembled on the fly.

### Ambiguous fields

- `translated_explanation` is overloaded. It may be a clean translation, a meaning translation, or a translated explanation. The schema does not distinguish them.
- `english_explanation` is overloaded. It functions as flashcard definition, plain meaning, and de facto core meaning.
- `example_text`, `context_sentence`, and `drill_answer_sets.__meta__.practice_example_sentence` all compete as possible sentence sources.
- `DrillItem.correctAnswer` is overloaded. For phrases it can become `example_text || english_explanation`, while most adapters still rely on `plainMeaning`.
- Student-specific overrides exist on `vocabulary_item_details`, but the drill pipeline currently reads raw `english_explanation` and `translated_explanation` in `toDrillItem(...)` instead of the effective override helpers.

## 4. Exercise-to-Content Mapping

| Exercise type | Exact content fields used | Known weakness / risk |
|---|---|---|
| `meaning_match` | `english_explanation` via `plainMeaning`; `__meta__.refined_definition`; other items' `context_meaning`, `synonym`, `distractors` for distractor pool | No separate `core_meaning`; base meaning is just `english_explanation` |
| `translation_match` | `translation_english_to_native`, `translation_native_to_english`, `translated_explanation`, `item_text` | No true single-word translation field; native side is inferred from answer set or `translated_explanation` |
| `pair_match.word_definition` | `item_text`, `english_explanation` | Works off base definition only; no stronger sense model |
| `pair_match.english_native` | `item_text`, `getPreferredNativeTranslation(...)` from stored translation answer set or `translated_explanation` | Translation quality depends on overloaded `translated_explanation` |
| `listen_match` single | `audio_url`, `audio_status`, `translation_english_to_native`, `context_meaning`, `translated_explanation`, `english_explanation` | Single fallback supports `translation` or `meaning`, not English-word variant |
| `listen_match` grouped translation | audio-ready items, `getTranslatedMeaning(item)` for inclusion, `getPreferredNativeTranslation(...)` for right labels | Inclusion gate is weaker than label quality gate; items can enter because `translated_explanation` exists even if no usable lexical translation exists |
| `listen_match` grouped English | audio-ready items, `item_text` | Only available in grouped mode; no single-word English listen drill |
| `listen_match` grouped meaning | audio-ready items, `english_explanation` via `getPlainMeaning(...)` | Meaning labels are not separate `core_meaning` values |
| `spelling_from_audio` | `audio_url`, `audio_status`, `item_text`, feedback `translation_text` from `getFeedbackNativeTranslation(...)` | Feedback translation depends on the same overloaded translation fields |
| `context_meaning` | `context_meaning` answer set, `practice_example_sentence`, fallback `example_text`, fallback `context_sentence`, fallback `english_explanation` | Shared content engine generates practice sentence context-free; lesson-specific context is only a fallback |
| `synonym` | `synonym` answer set, `__meta__.synonym_candidates`, `__meta__.antonym_candidates`, `practice_example_sentence`, `item.distractors`, cross-item candidate pools | Synonym and antonym quality depend on reusable meta richness; no sense-level grounding |
| `fill_blank` | `context_sentence`, `collocation` answer set, lexical distractor pool, captured pool | Implemented but not live; depends on sentence quality and collocation quality |
| `collocation` | `context_sentence` or `example_text`, `collocation` answer set | Implemented but not live; still uses source sentence / generic example overload |
| `sentence_builder` | `context_sentence` or `example_text` split into tiles | Implemented but not live; no dedicated sentence asset beyond general sentence fields |
| `error_detection` | source sentence, lexical distractor replacement from candidate pool | Implemented but not live; generated by substitution heuristic, not stored confusion-specific asset |

## 5. Grouped Drill Analysis

### Grouped audio -> translation

Assembly path:

1. `adaptListenMatchDrillsToExercises(...)`
2. Filters `audioReadyItems`
3. Further filters with `Boolean(getTranslatedMeaning(item))`
4. Dedupes with `dedupeListenPairItems(..., "translation")`
5. Chunks with `chunkItemsBalanced(..., 8, 10, 4)`
6. Builds grouped exercise via `buildListenPairMatchExercise(...)`

Important behavior:

- Right-side labels come from `getListenPairRightLabel(item, "translation")`
- That label resolves to `getPreferredNativeTranslation(item) ?? getPlainMeaning(item)`
- Inclusion uses raw `translated_explanation`
- Right-side label quality uses a stricter translation scoring helper

Risk:

- The inclusion filter and final label source do not match.
- An item can qualify for grouped translation because `translated_explanation` is non-empty, then still fall back to English meaning on the right if the translation helper rejects it.
- This is one of the strongest structural reasons the grouped translation UX can feel weak or inconsistent.

### Grouped audio -> English

Assembly path:

- Same grouped listen path
- Deduped by `item_text` and right-side label
- Right-side labels are always `item_text`

Behavior:

- Available only in grouped mode
- Single-item listen fallback never produces English-word matching

### Grouped audio -> meaning

Assembly path:

- Same grouped listen path
- Right-side labels are `getPlainMeaning(item)`

Risk:

- `getPlainMeaning(item)` is just `english_explanation`
- There is no separate `core_meaning` field tuned for concise grouped matching

### Pair match variants

Current generated variants:

- `word_definition`
- `english_native`

Assembly:

- `dedupePairEntries(...)`
- `chunkItemsBalanced(..., 6, 8, 4)`
- `buildPairMatchExercise(...)`

Not currently generated even though supported in types:

- `native_english`
- `synonym_pair`
- `collocation_pair`

### How distractors are assembled

- Stored answer set distractors are preferred when available.
- If stored answer sets are weak or absent, adapters rank candidates from cross-word pools.
- Cross-word pools currently mix:
  - other words' `item_text`
  - other words' `english_explanation`
  - other words' stored answer-set answers
  - stored candidate meta such as `synonym_candidates`
- `fill_blank` and `synonym` are the clearest places where distractors can be influenced by the student's captured vocabulary pool.

## 6. Retry / Session Behavior Analysis

### Where session size is set

Primary control is in `getStudentVocabularyPageData(...)`:

- Guided lesson intro:
  - `priorityTargetSize = guidedLessonIntroCandidates.length`
- `learn_new_words`:
  - priority target up to 6
  - continuation target up to 6
- other live modes:
  - priority target up to 8
  - continuation target up to 8

Fallback control also exists in `buildVocabExerciseSession(...)`:

- `learn_new_words` default 6
- `review_weak_words` / `weak_first` default 8
- `default_review` default 10
- others default 7

In the main live path, the page service usually passes an explicit target size, so the page-service sizing is the real source of truth.

### Where one-word vs grouped logic is decided

- Grouped drill assembly happens inside `exercise-adapters.ts`
- `listen_match` grouped variants are assembled before single fallback
- `pair_match` grouped variants are assembled directly from all eligible items
- `groupExercisesByWord(...)` in `session-builder.ts` groups all candidate exercises by `target_word_id`
- Final session selection is therefore one chosen exercise per anchor word id

Important consequence:

- A grouped exercise can cover 4 to 10 words, but it still occupies one slot in session sizing and one anchor `target_word_id` in the final session metadata.
- Grouped exercises therefore undercount actual word coverage in session metrics.

### Where retries are appended

Retries are controlled in `ExercisePlayer.tsx`.

Rules:

- Incorrect answer appends one retry to the end of the queue using `buildRetryExercise(...)`
- Retries are blocked for:
  - `pair_match`
  - `listen_match`
  - any exercise that is already a retry

This means:

- single-word drills get at most one appended retry
- grouped drills never retry inside the same session queue

## 7. Risks and Recommended Changes

### Verified findings

#### `translation_word` presence / absence

- There is no dedicated `translation_word` field in the current schema or drill types.
- Repo-wide search does not reveal a `translation_word`, `single_word_translation`, or equivalent core lexical translation field.
- Current translation handling depends on:
  - `drill_answer_sets.translation_english_to_native.drill_correct_answer`
  - `translated_explanation`

#### `core_meaning` presence / absence

- There is no dedicated `core_meaning` field in the current schema or types.
- Current meaning handling depends on:
  - `english_explanation`
  - `drill_answer_sets.context_meaning.drill_correct_answer`
  - `__meta__.refined_definition`

#### Grouped audio / translation UX

- The current grouped audio-translation UX is structurally weak because content structure does not separate lexical translation from explanation-style translation.
- Inclusion for grouped translation uses `translated_explanation` presence, while final display tries to use `getPreferredNativeTranslation(...)`.
- This mismatch can admit items whose final right-side label is not actually a clean native-language translation.

### Top content quality risks

1. `translated_explanation` is overloaded and is not a reliable substitute for a true lexical translation field.
2. `english_explanation` is overloaded and acts as both flashcard meaning and de facto core meaning.
3. Shared answer-set generation is context-light by design. `ensureReusableVocabularyContent(...)` passes `contextSentence: null`, so reusable `practice_example_sentence` is generic rather than lesson-specific.
4. Grouped translation listen drills use a weaker admission gate than their final label-quality gate.
5. Student-specific overrides exist, but `toDrillItem(...)` currently reads raw `english_explanation` / `translated_explanation` instead of the effective override helpers.

### Recommended changes

1. Add a true lexical translation field, separate from translated explanation.
2. Add a true `core_meaning` field, separate from flashcard definition variants and context explanation.
3. Normalize sentence fields into a clearer hierarchy:
   - lesson context sentence
   - shared practice sentence
   - generic example sentence
4. Tighten grouped translation eligibility to require a usable lexical translation, not merely a non-empty `translated_explanation`.
5. Decide explicitly whether student-specific overrides should flow into drill composition or stay card-only.

## 8. Suggested Implementation Plan

Recommended order of work, without implementing it yet:

1. Formalize the reusable content schema:
   - add `translation_word`
   - add `core_meaning`
   - preserve existing `english_explanation` / `translated_explanation` for compatibility
2. Clarify sentence sources:
   - store explicit `lesson_context_sentence`
   - keep `practice_example_sentence`
   - keep `example_text` as generic fallback only
3. Refactor adapters to consume normalized primitives instead of overloaded fields:
   - `translation_match`, grouped translation listen, and spelling feedback should use `translation_word`
   - `meaning_match`, grouped meaning listen, and pair definition should use `core_meaning`
4. Tighten grouped drill assembly:
   - require explicit quality gates for grouped translation labels
   - decide whether grouped drills should count as one slot or many target words in session accounting
5. Reintroduce dormant drill types only after the above primitives exist:
   - `fill_blank`
   - `collocation`
   - `sentence_builder`
   - `error_detection`

## Appendix: Compatibility Notes

- Current live sessions should keep working because they are built from student rows hydrated from the shared cache.
- Global reusable content reuse is already in place through `vocabulary_dictionary_cache`.
- Student-specific progress remains separate in `word_progress`, `review_queue`, `exercise_attempts`, and `vocabulary_item_details`.
- Current architecture already separates:
  - global reusable content
  - student progress
  - session composition
- The main remaining issue is content shape quality, not the absence of a reuse layer.
