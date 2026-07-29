# Vocabulary Content Quality Report

Generated: 2026-07-29T05:29:28.699Z

This read-only audit examines vocabulary drill content stored in Supabase. The primary dataset is `vocabulary_dictionary_cache`, the shared reusable content layer. A supplemental sample from `vocabulary_item_details` is included only for context.

## Dataset

- Global reusable rows examined: 326 of 326
- Student materialized rows sampled: 327 of 327
- Tables inspected: `vocabulary_dictionary_cache`, `vocabulary_item_details`
- Mutations performed: none

## Field Coverage

Actual coverage means the gold-content column itself is populated. Resolved coverage means backward-compatible fallback can derive a usable value from legacy fields.

| Field | Actual coverage | Resolved/fallback coverage |
| --- | --- | --- |
| core_meaning | 94.8% (309/326) | 100% (326/326) |
| definition | 94.8% (309/326) | 100% (326/326) |
| translation_word | 78.2% (255/326) | 87.7% (286/326) |
| translation_meaning | 94.8% (309/326) | 100% (326/326) |
| synonyms | 71.2% (232/326) | 77.6% (253/326) |
| antonyms | 42% (137/326) | 46.9% (153/326) |
| example_sentence | 94.8% (309/326) | 100% (326/326) |
| audio_text | 94.8% (309/326) | 100% (326/326) |

## Top Recurring Problems

| Issue | Count | Percent |
| --- | --- | --- |
| missing_antonyms | 189 | 58% |
| missing_synonyms | 94 | 28.8% |
| core_meaning_identical_to_definition | 79 | 24.2% |
| missing_translation_word | 71 | 21.8% |
| audio_text_too_long | 21 | 6.4% |
| core_meaning_too_long_or_noisy | 21 | 6.4% |
| translation_word_identical_to_translation_meaning | 19 | 5.8% |
| missing_audio_text | 17 | 5.2% |
| missing_core_meaning | 17 | 5.2% |
| missing_definition | 17 | 5.2% |
| missing_example_sentence | 17 | 5.2% |
| missing_translation_meaning | 17 | 5.2% |
| translation_word_too_long_or_noisy | 8 | 2.5% |
| example_sentence_missing_target_word | 5 | 1.5% |

## Exercise Readiness Assessment

| Exercise | Ready rows | Top blockers |
| --- | --- | --- |
| groupedAudioTranslation | 85.3% (278/326) | missing_translation_word: 40; translation_word_not_concise: 8 |
| groupedAudioEnglish | 100% (326/326) | none |
| groupedAudioMeaning | 93.6% (305/326) | core_meaning_not_concise: 21 |
| pairMatchWordTranslation | 85.3% (278/326) | missing_translation_word: 40; translation_word_not_concise: 8 |
| translationMatch | 55.8% (182/326) | missing_translation_answer_set_distractors: 118; missing_translation_word: 40; translation_word_not_concise: 8 |
| contextMeaning | 59.8% (195/326) | missing_context_meaning_answer_set_distractors: 118; core_meaning_not_concise: 21; example_sentence_missing_target_word: 5 |

## Grouped Drill Analysis

### Grouped audio -> translation

- Requires concise `translation_word` plus `audio_text` or `item_text`.
- Duplicate right-side translations can make grouped matching ambiguous.
- Duplicate translation_word values found: 12

- `ru` translation `вешалка` appears 2 times
- `ru` translation `всплеск` appears 2 times
- `ru` translation `глазури` appears 2 times
- `ru` translation `зазубренный` appears 2 times
- `ru` translation `кафедры` appears 2 times
- `ru` translation `набег` appears 2 times
- `ru` translation `они сказали` appears 2 times
- `ru` translation `осторожный` appears 2 times

### Grouped audio -> English

- Requires usable `audio_text` or fallback to `item_text`.
- Structurally strongest grouped audio mode because the right side is the vocabulary word itself.

### Grouped audio -> meaning

- Requires concise `core_meaning`; long definitions are not suitable in fast matching UI.
- Duplicate core_meaning values found: 2

- `ru` meaning `meaning of this word in the passage.` appears 3 times
- `ru` meaning `strong desires or yearnings` appears 2 times

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
| following Jem’s red jacket through wriggling circles of blind man’s buff, | ru | c82ea1ca-f5bd-425d-b8cd-255e4af8a74f | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| haze for days. | ru | 873dbf59-e8f0-4a1b-9ea0-c6c7a4e58606 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| Jem was in a haze for days. | ru | 13e48ebc-ca52-4c20-b2d4-64a0bbd004b0 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| pass and punt. | ru | 1b72702b-2bd1-47a1-beb6-733788ccee58 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| should she prove to harbor her share of the peculiarities indigenous to that region | ru | 9793783c-c2e2-448b-8fac-7856d21b9434 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| he was seldom self-conscious about his injury | ru | 1da52eb0-82dc-4640-8cc7-ff36a2678e7c | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| I’ll take over from here | ru | 836f8b7d-6f50-4b2c-8ce7-3ea9e1c59330 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| prove to harbor | ru | 0198b9be-40b1-4746-9dc4-43d17c757268 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| thumb parallel to his thigh | ru | 7191a8c9-a830-4323-9813-983cf9934a82 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| well-meaning | ru | b48f3042-7381-405b-9b30-31ee5513d8e9 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| whose piety was exceeded only by his stinginess | ru | 281e4743-25fc-40ca-82db-a708c0700cd8 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| Ewells | ru | e463f722-fdc0-4061-a708-f25b14da0643 | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| faint distaste | ru | 6fbbd91e-1cac-4be7-ac30-9d6f5c319bbe | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| faint line | ru | d9915f72-3c4e-4a24-ac8f-60bc33770d6f | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |
| matches | ru | 8eab7f2b-9070-4a9b-a003-38834c1867cd | missing_core_meaning, missing_definition, missing_translation_word, missing_translation_meaning, missing_synonyms, missing_antonyms |

## Recommendations

### Regenerate

- Count: 7
- Use for rows where multiple critical fields are missing and neither grouped nor translation/context drills are content-ready.

### Repair

- Count: 192
- Use targeted repair for rows with useful legacy content but missing gold fields, especially `translation_word`, `core_meaning`, and `example_sentence`.

### Acceptable As-Is

- Count: 127
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
