# Vocab Bulk Generation

Date: 2026-04-23

This document describes the admin-safe bulk AI pipeline for generating reusable vocabulary drill content.

## Architecture Flow

The pipeline generates reusable content records, not exercise instances.

Flow:

1. Admin sends a batch request to `POST /api/admin/vocabulary/bulk-generate`.
2. The route verifies the admin session cookie.
3. `runVocabularyGoldContentBulkGeneration(...)` builds candidates from:
   - explicit `words`
   - `vocabulary_item_details` IDs
4. Existing reusable rows are loaded from `vocabulary_dictionary_cache`.
5. Valid existing content is skipped unless `mode = "full_regenerate"`.
6. Missing or weak content is sent to AI in batches.
7. Generated JSON is sanitized and validated.
8. Repairable failures go through a small targeted repair prompt.
9. Valid content is upserted into `vocabulary_dictionary_cache`, unless `dryRun = true`.

The student session builder still composes exercises deterministically later.

## Generated Fields

The target content package is:

- `word`
- `part_of_speech`
- `core_meaning`
- `definition`
- `translation_word`
- `translation_meaning`
- `synonyms`
- `antonyms`
- `example_sentence`
- `example_translation`
- `audio_text`

## Prompt Strategy

Generation prompt:

- centralized in `src/services/ai/generate-vocabulary-gold-content-bulk.ts`
- versioned as `vocab_gold_content_v1`
- uses strict JSON only
- includes few-shot examples that distinguish:
  - `translation_word`
  - `translation_meaning`
  - `core_meaning`
  - `definition`

Repair prompt:

- versioned as `vocab_gold_content_repair_v1`
- repairs only failing fields
- avoids regenerating the whole record when one field is weak

## Validation Rules

Validation lives in:

- `src/services/vocabulary/vocabulary-gold-content-validation.service.ts`

Rules include:

- `core_meaning` should be short and concise.
- `translation_word` should be short, ideally 1-3 words.
- `translation_word` should not equal the English word.
- `translation_word` and `translation_meaning` should usually differ.
- `example_sentence` should contain the target word or a clear inflected form.
- `synonyms` must not include the target word.
- `definition` should not be excessively long.
- `audio_text` defaults to the word when missing.

Rows with validation errors are not saved unless the repair pass fixes them.

## Persistence

Valid content is saved to the shared reusable layer:

- table: `vocabulary_dictionary_cache`

The pipeline preserves existing reusable drill assets where possible:

- `distractors`
- `drill_answer_sets`
- `alternate_definitions`
- `collocations`
- `confusion_pairs`

Bulk-generation provenance is stored inside:

- `drill_ingredients.bulk_gold_generation`

Stored metadata includes:

- mode
- prompt version
- model
- generated timestamp
- validation issue summary

The main `prompt_version` column remains compatible with the existing reuse engine so this rollout does not accidentally mark every shared row as stale.

## How To Run

Run the app, log in as admin, then POST to the admin route.

Dry run is the default:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/admin/vocabulary/bulk-generate" `
  -Method Post `
  -ContentType "application/json" `
  -WebSession $adminSession `
  -Body (@{
    words = @("prudent", "fist-fight", "imprudent")
    translationLanguage = "ru"
    batchSize = 50
    dryRun = $true
    mode = "repair_missing"
  } | ConvertTo-Json -Depth 8)
```

To write valid content:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/admin/vocabulary/bulk-generate" `
  -Method Post `
  -ContentType "application/json" `
  -WebSession $adminSession `
  -Body (@{
    words = @("prudent", "fist-fight", "imprudent")
    translationLanguage = "ru"
    batchSize = 50
    dryRun = $false
    mode = "repair_missing"
  } | ConvertTo-Json -Depth 8)
```

Generate from existing student vocabulary rows:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/admin/vocabulary/bulk-generate" `
  -Method Post `
  -ContentType "application/json" `
  -WebSession $adminSession `
  -Body (@{
    vocabularyItemIds = @("00000000-0000-0000-0000-000000000000")
    translationLanguage = "ru"
    dryRun = $true
  } | ConvertTo-Json -Depth 8)
```

## Modes

### `repair_missing`

Default mode.

- skips valid existing shared rows
- generates missing rows
- repairs weak rows
- safest rollout mode

### `full_regenerate`

Use only for targeted subsets.

- regenerates the selected words even if content already exists
- still validates before saving
- still uses targeted repair instead of saving invalid content

## Observability

The route response includes:

- total candidates
- generated count
- fixed count
- failed count
- skipped count
- saved count
- per-batch summaries
- per-item validation issues and errors

The server logs one summary per batch:

```text
vocab gold content batch { batch, candidateCount, generated, fixed, failed, skipped, saved, dryRun }
```

## Safe Rollout Guidance

Recommended order:

1. Run `docs/vocab-content-quality-report.md` audit first.
2. Dry-run a small word list.
3. Dry-run 10-20 real `vocabulary_item_details` IDs.
4. Write a small batch with `dryRun = false`.
5. Re-run the quality audit.
6. Expand batch size gradually.

Use `repair_missing` for broad rollout. Reserve `full_regenerate` for known bad records.

## Failure Review

Failed items appear in the route response with:

- `word`
- `canonicalLemma`
- `issues`
- `repairFields`
- `error`

Common fixes:

- missing or bad `translation_word`: run targeted repair or full regenerate
- bad `example_sentence`: repair `example_sentence`
- overlong `core_meaning`: repair `core_meaning`

No production data is changed in dry-run mode.
