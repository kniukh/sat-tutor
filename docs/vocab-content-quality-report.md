# Vocabulary Content Quality Report

Generated: 2026-04-23T10:32:42.350Z

This read-only audit examines vocabulary drill content stored in Supabase. The primary dataset is `vocabulary_dictionary_cache`, the shared reusable content layer. A supplemental sample from `vocabulary_item_details` is included only for context.

## Dataset

- Global reusable rows examined: 250 of 250
- Student materialized rows sampled: 254 of 254
- Tables inspected: `vocabulary_dictionary_cache`, `vocabulary_item_details`
- Mutations performed: none

## Field Coverage

Actual coverage means the gold-content column itself is populated. Resolved coverage means backward-compatible fallback can derive a usable value from legacy fields.

| Field | Actual coverage | Resolved/fallback coverage |
| --- | --- | --- |
| core_meaning | 96.8% (242/250) | 100% (250/250) |
| definition | 96.8% (242/250) | 100% (250/250) |
| translation_word | 0.8% (2/250) | 60% (150/250) |
| translation_meaning | 96.8% (242/250) | 100% (250/250) |
| synonyms | 3.2% (8/250) | 3.6% (9/250) |
| antonyms | 2.8% (7/250) | 2.8% (7/250) |
| example_sentence | 96.8% (242/250) | 100% (250/250) |
| audio_text | 96.8% (242/250) | 100% (250/250) |

## Top Recurring Problems

| Issue | Count | Percent |
| --- | --- | --- |
| missing_translation_word | 248 | 99.2% |
| missing_antonyms | 243 | 97.2% |
| core_meaning_identical_to_definition | 242 | 96.8% |
| missing_synonyms | 242 | 96.8% |
| core_meaning_too_long_or_noisy | 64 | 25.6% |
| translation_word_identical_to_translation_meaning | 48 | 19.2% |
| audio_text_too_long | 17 | 6.8% |
| translation_word_too_long_or_noisy | 17 | 6.8% |
| example_sentence_missing_target_word | 14 | 5.6% |
| missing_audio_text | 8 | 3.2% |
| missing_core_meaning | 8 | 3.2% |
| missing_definition | 8 | 3.2% |
| missing_example_sentence | 8 | 3.2% |
| missing_translation_meaning | 8 | 3.2% |

## Exercise Readiness Assessment

| Exercise | Ready rows | Top blockers |
| --- | --- | --- |
| groupedAudioTranslation | 53.2% (133/250) | missing_translation_word: 100; translation_word_not_concise: 17 |
| groupedAudioEnglish | 100% (250/250) | none |
| groupedAudioMeaning | 74.4% (186/250) | core_meaning_not_concise: 64 |
| pairMatchWordTranslation | 53.2% (133/250) | missing_translation_word: 100; translation_word_not_concise: 17 |
| translationMatch | 53.2% (133/250) | missing_translation_word: 100; missing_translation_answer_set_distractors: 85; translation_word_not_concise: 17 |
| contextMeaning | 54.4% (136/250) | missing_context_meaning_answer_set_distractors: 85; core_meaning_not_concise: 64; example_sentence_missing_target_word: 14 |

## Grouped Drill Analysis

### Grouped audio -> translation

- Requires concise `translation_word` plus `audio_text` or `item_text`.
- Duplicate right-side translations can make grouped matching ambiguous.
- Duplicate translation_word values found: 1

- `ru` translation `всплеск` appears 2 times

### Grouped audio -> English

- Requires usable `audio_text` or fallback to `item_text`.
- Structurally strongest grouped audio mode because the right side is the vocabulary word itself.

### Grouped audio -> meaning

- Requires concise `core_meaning`; long definitions are not suitable in fast matching UI.
- Duplicate core_meaning values found: 1

- `ru` meaning `meaning of this word in the passage.` appears 5 times

### Pair match variants

- Word -> translation should use `translation_word`.
- Word -> meaning should use `core_meaning`.
- Legacy fallback to `translated_explanation` or `english_explanation` is acceptable only when concise.

## Content Consistency

Rows below have the same lemma/language but inconsistent stored structures.

- No inconsistent duplicate structures found in sampled rows.

## Problematic Examples

| Word | Language | Record ID | Issues |
| --- | --- | --- | --- |
| the back of his hand was at right angles to his body, his thumb parallel to his thigh | ru | 301da3b1-25da-4b8f-b3fd-d18aad3a298f | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| pass and punt. | ru | 1b72702b-2bd1-47a1-beb6-733788ccee58 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| he was seldom self-conscious about his injury | ru | 1da52eb0-82dc-4640-8cc7-ff36a2678e7c | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| thumb parallel to his thigh | ru | 7191a8c9-a830-4323-9813-983cf9934a82 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| Dill was a curiosity | ru | 01c8a55e-6c34-489e-897c-6cbe782e28c4 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| Ewells | ru | e463f722-fdc0-4061-a708-f25b14da0643 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| mishap | ru | 37357976-4aa9-4a48-8091-8295d82e4ed9 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| thrust | ru | a69d839d-08e0-4ee1-83c4-c7b1a6bbb9fb | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| and one night I heard him scratching on the back screen | ru | e85d2b91-9224-48f6-8a43-ea6181a783b5 | missing_translation_word, missing_synonyms, missing_antonyms, core_meaning_too_long_or_noisy, core_meaning_identical_to_definition, example_sentence_missing_target_word |
| it ran in her family. I did not | ru | a1595a70-41d5-4c32-ba5c-a9303cdab2a7 | missing_translation_word, missing_synonyms, missing_antonyms, core_meaning_too_long_or_noisy, core_meaning_identical_to_definition, example_sentence_missing_target_word |
| lest | ru | e3a94d72-a39c-42cd-84e7-84a1bd0df27f | missing_translation_word, missing_synonyms, missing_antonyms, core_meaning_too_long_or_noisy, translation_word_too_long_or_noisy, translation_word_identical_to_translation_meaning |
| mother died from a sudden heart attack. They said | ru | 44d036b5-fb97-42f1-ab95-e3ae824be8a9 | missing_translation_word, missing_synonyms, missing_antonyms, core_meaning_too_long_or_noisy, core_meaning_identical_to_definition, example_sentence_missing_target_word |
| plead | ru | 0923d834-239b-4138-904d-f0b1b77b895c | missing_translation_word, missing_synonyms, missing_antonyms, core_meaning_too_long_or_noisy, translation_word_too_long_or_noisy, translation_word_identical_to_translation_meaning |
| the sidewalk turned and ran beside the lot. | ru | 474a083e-4db2-4914-9062-7072261671de | missing_translation_word, missing_synonyms, missing_antonyms, core_meaning_too_long_or_noisy, core_meaning_identical_to_definition, example_sentence_missing_target_word |
| you ran out on a dare an‘ I’ll swap you | ru | 1c95af7a-eff8-4b2b-80db-54778c409985 | missing_translation_word, missing_synonyms, missing_antonyms, core_meaning_too_long_or_noisy, core_meaning_identical_to_definition, example_sentence_missing_target_word |

## Recommendations

### Regenerate

- Count: 12
- Use for rows where multiple critical fields are missing and neither grouped nor translation/context drills are content-ready.

### Repair

- Count: 238
- Use targeted repair for rows with useful legacy content but missing gold fields, especially `translation_word`, `core_meaning`, and `example_sentence`.

### Acceptable As-Is

- Count: 0
- Rows with no major quality issues and enough content to support live drills.

## Key Findings

- `translation_word` is the highest-leverage field for grouped audio -> translation and word -> translation pair match.
- `core_meaning` should power fast English meaning matching; long `definition` text should not be used in grouped cards.
- `audio_text` can safely fall back to `item_text`, but explicit coverage helps with phrases and TTS normalization.
- `example_sentence` is the main blocker for high-quality context meaning exercises.

## How To Re-run

```powershell
node scripts/admin/audit-vocab-content-quality.js --limit 1000 --output docs/vocab-content-quality-report.md
```
