# Vocab Content Schema

Date: 2026-04-13

This document describes the backward-compatible evolution of SAT Tutor's vocabulary drill content model toward a stronger reusable "gold content layer".

## Old Schema Summary

Before this change, the shared reusable vocabulary layer was centered around these fields in `vocabulary_dictionary_cache`:

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

Student-specific rows in `vocabulary_item_details` stored a materialized subset:

- `english_explanation`
- `translated_explanation`
- `example_text`
- `context_sentence`
- `distractors`
- `drill_answer_sets`
- `audio_url`
- `audio_status`

### Old model limitations

- `english_explanation` had to serve as both concise meaning and fuller definition.
- `translated_explanation` had to serve as both lexical translation and meaning translation.
- there was no explicit `audio_text`
- there was no explicit `part_of_speech`
- there was no single normalized "gold" content snapshot for the drills to target

## New Schema Summary

The new schema adds a clearer gold drill-content layer.

### Added to `vocabulary_dictionary_cache`

- `core_meaning`
- `definition`
- `translation_word`
- `translation_meaning`
- `synonyms`
- `antonyms`
- `example_sentence`
- `example_translation`
- `audio_text`
- `part_of_speech`

### Added to `vocabulary_item_details`

These same fields are also added as materialized compatibility fields on student rows:

- `core_meaning`
- `definition`
- `translation_word`
- `translation_meaning`
- `synonyms`
- `antonyms`
- `example_sentence`
- `example_translation`
- `audio_text`
- `part_of_speech`

The source of truth remains the shared reusable content in `vocabulary_dictionary_cache`. Student rows may mirror these fields for compatibility and faster hydration, but they do not replace the shared content layer.

## Field Purpose

### `core_meaning`

Short concise English gloss, ideally suited for:

- grouped meaning drills
- pair match meaning labels
- quick drill prompts

### `definition`

Fuller explanatory meaning, intended for:

- card display
- definition-style exercises
- richer fallback when `core_meaning` is too terse

### `translation_word`

Short natural translation of the vocabulary word or phrase itself.

Use for:

- grouped `audio -> translation`
- `English -> Native` lexical matching
- `Listen Type` feedback translation

### `translation_meaning`

Translation of the meaning/definition rather than the surface word.

Use for:

- flashcard explanation translation
- fallback when lexical translation is unavailable

### `synonyms`

Reusable short synonym candidates for:

- synonym drills
- substitution-style drill composition

### `antonyms`

Reusable antonym candidates for:

- antonym drill variants
- future harder contrast exercises

### `example_sentence`

Preferred natural example sentence for drill composition.

Use for:

- `context_meaning`
- future `fill_blank`
- future `sentence_builder`
- future `error_detection`

### `example_translation`

Translation of the example sentence when available.

Not yet required by the current drill pipeline, but now available as a first-class field.

### `audio_text`

Exact text intended for TTS/audio matching.

Defaults to the vocabulary item text when not customized.

### `part_of_speech`

Best available POS label for drill composition and future distractor control.

## Fallback Logic

All fallback logic is centralized in:

- [resolved-vocabulary-drill-content.service.ts](/c:/Users/user/Desktop/Проект/SAT%20Tutor/sat-tutor/src/services/vocabulary/resolved-vocabulary-drill-content.service.ts)

Main resolver:

- `resolveSafeVocabularyDrillContent(...)`

### Current fallback rules

#### `audio_text`

- use explicit `audio_text`
- otherwise default to `item_text`

#### `core_meaning`

- use explicit `core_meaning`
- otherwise use `drill_answer_sets.__meta__.refined_definition`
- otherwise first alternate definition if present
- otherwise fallback to `english_explanation`

#### `definition`

- use explicit `definition`
- otherwise fallback to `english_explanation`
- otherwise fallback to resolved `core_meaning`

#### `translation_word`

- use explicit `translation_word`
- otherwise allow a strong existing lexical source only:
  - `drill_answer_sets.translation_english_to_native.drill_correct_answer` if it looks short and lexical
- otherwise `null`

Important:

- the resolver does **not** blindly fake `translation_word` from `translated_explanation`

#### `translation_meaning`

- use explicit `translation_meaning`
- otherwise fallback to `translated_explanation`

#### `synonyms`

- use explicit `synonyms`
- otherwise fallback to `synonym_candidates`

#### `antonyms`

- use explicit `antonyms`
- otherwise fallback to `antonym_candidates`

#### `example_sentence`

- use explicit `example_sentence`
- otherwise use `drill_answer_sets.__meta__.practice_example_sentence`
- otherwise fallback to `example_text`
- otherwise fallback to first `example_sentences` entry
- otherwise fallback to `context_sentence`

#### `example_translation`

- use explicit `example_translation`
- otherwise `null`

#### `part_of_speech`

- use explicit `part_of_speech`
- otherwise infer from stored answer-set normalization when available
- otherwise if item is a phrase, use `phrase`
- otherwise leave `null`

## Which Exercise Types Should Use Which Fields

This section describes intended field usage after the schema evolution. It does not force immediate behavioral changes in the current live drills.

### `meaning_match`

Prefer:

- `definition`

Fallback:

- `core_meaning`

### `translation_match`

For lexical translation:

- `translation_word`

Fallback:

- `translation_meaning`

### `pair_match`

`word -> meaning`

- prefer `core_meaning`
- fallback `definition`

`English -> translation`

- prefer `translation_word`
- fallback `translation_meaning`

### `listen_match`

`audio -> translation`

- prefer `translation_word`
- fallback `translation_meaning` only if needed

`audio -> English`

- use `audio_text` for spoken form
- use `item_text` for display match target

`audio -> meaning`

- prefer `core_meaning`
- fallback `definition`

### `spelling_from_audio`

Audio source:

- `audio_text`

Feedback translation:

- prefer `translation_word`
- fallback `translation_meaning`

### `context_meaning`

Sentence source:

- prefer `example_sentence`
- fallback existing sentence sources

Meaning target:

- prefer `core_meaning`
- fallback `definition`

### `synonym`

- prefer `synonyms`
- fallback existing synonym answer-set candidates

### `fill_blank`

Sentence source:

- prefer `example_sentence`

Correct-answer support:

- `item_text`
- `part_of_speech`
- future collocation-aware ingredients

### `collocation`

- prefer `example_sentence`
- use `part_of_speech`
- use stored collocation answer sets / collocation ingredients

### `sentence_builder`

- prefer `example_sentence`

### `error_detection`

- prefer `example_sentence`
- future confusion-pair logic can also use `confusion_pairs`

## Compatibility Notes

- Old content still loads because existing fields remain in place.
- New fields are additive; no destructive rename was used.
- Shared reusable content remains in `vocabulary_dictionary_cache`.
- Student rows remain compatible because:
  - existing fields are untouched
  - new materialized fields are optional
  - hydration now populates the new gold content fields safely
- Current live drill behavior does not need to change immediately to benefit from the new schema plumbing.

## Current Exercise Assembly Mapping

The live adapter layer now prefers the gold content fields for exercise assembly while preserving explicit safe fallbacks for legacy rows.

### Fast meaning surfaces

Used by:

- `meaning_match`
- `pair_match` word -> meaning
- grouped `listen_match` audio -> meaning
- `context_meaning`

Priority:

1. `core_meaning`
2. `drill_answer_sets.context_meaning.drill_correct_answer` when concise
3. `drill_answer_sets.__meta__.refined_definition` when concise
4. legacy `english_explanation` / `plainMeaning` only when concise for grouped surfaces
5. `definition` only for non-compact single-card fallback

Grouped meaning drills require concise labels and do not intentionally fall back to long definition-like text.

### Translation surfaces

Used by:

- `translation_match`
- `pair_match` English -> translation
- grouped `listen_match` audio -> translation
- `spelling_from_audio` feedback

Priority:

1. `translation_word`
2. `drill_answer_sets.translation_english_to_native.drill_correct_answer` only when short and native-looking
3. `translation_meaning` only when concise enough for the UI
4. legacy `translated_explanation` only when concise enough for the UI

Fast grouped translation drills should not use long meaning translations. If no concise lexical translation is available, the item is excluded from the grouped translation exercise.

### Context surfaces

Used by:

- `context_meaning`
- synonym/substitution sentence prompts
- future sentence-driven drills

Priority:

1. `example_sentence`
2. `drill_answer_sets.__meta__.practice_example_sentence`
3. legacy `example_text`
4. source context only as a fallback where the exercise can still render safely

### Semantic candidate surfaces

Used by:

- `synonym`
- antonym variant of `synonym`

Priority:

1. `synonyms` / `antonyms`
2. `drill_answer_sets.__meta__.synonym_candidates`
3. `drill_answer_sets.__meta__.antonym_candidates`
4. stored normalized answer-set distractors and captured-word pools as distractors only

Antonym variants require concise high-confidence candidates; otherwise the variant is not emitted.
