# Vocabulary Content Backfill Ops

This document describes the admin-safe workflow for finding and repairing reusable vocabulary drill content in Supabase.

The workflow is intentionally conservative:

- default command only plans candidates
- default command does not call AI
- default command does not write to Supabase
- actual generation reuses the existing admin bulk API and shared content pipeline

## Files

- Script: `scripts/admin/backfill-vocab-content.js`
- Existing generation route: `POST /api/admin/vocabulary/bulk-generate`
- Existing generation service: `src/services/vocabulary/vocabulary-gold-content-bulk.service.ts`
- Shared content table: `vocabulary_dictionary_cache`
- Student vocabulary table: `vocabulary_item_details`

## Common Commands

Plan a safe default backfill. This finds rows missing `translation_word`, `core_meaning`, or `example_sentence`.

```powershell
node scripts/admin/backfill-vocab-content.js --limit 25
```

Plan only rows missing lexical translations and short meanings.

```powershell
node scripts/admin/backfill-vocab-content.js --missing translation_word,core_meaning --limit 25
```

Plan outdated rows.

```powershell
node scripts/admin/backfill-vocab-content.js --outdated --generation-version 2 --limit 25
```

Plan specific shared content records.

```powershell
node scripts/admin/backfill-vocab-content.js --ids <dictionary-cache-id-1>,<dictionary-cache-id-2>
```

Plan specific student vocabulary rows.

```powershell
node scripts/admin/backfill-vocab-content.js --vocabulary-ids <vocabulary-item-id-1>,<vocabulary-item-id-2>
```

Plan explicit words.

```powershell
node scripts/admin/backfill-vocab-content.js --words prudent,imprudent --translation-language ru
```

Write a JSON plan for review.

```powershell
node scripts/admin/backfill-vocab-content.js --missing translation_word,core_meaning --limit 25 --json-output tmp/vocab-backfill-plan.json
```

## Execution Modes

### Planner Only

This is the default. It queries Supabase and prints the candidate plan. It does not call AI.

```powershell
node scripts/admin/backfill-vocab-content.js --missing translation_word --limit 10
```

### API Dry Run

This calls the existing admin bulk API with `dryRun = true`. It can spend AI tokens, but it does not save valid content.

Make sure the app server is running first:

```powershell
npm run dev
```

Then run:

```powershell
node scripts/admin/backfill-vocab-content.js --execute --missing translation_word --limit 10
```

### Write Valid Content

This calls the existing admin bulk API with `dryRun = false`. Valid generated/repaired content is upserted into `vocabulary_dictionary_cache`.

```powershell
node scripts/admin/backfill-vocab-content.js --execute --write --missing translation_word,core_meaning --limit 10
```

## Repair Missing Fields

Use `repair_missing` for normal rollout. This is the default mode.

```powershell
node scripts/admin/backfill-vocab-content.js `
  --execute `
  --write `
  --mode repair_missing `
  --missing translation_word,core_meaning `
  --limit 25 `
  --batch-size 25
```

This does two safe things:

- candidate selection is limited to rows missing selected fields
- the existing bulk service still skips valid existing shared content

## Full Regenerate

Use `full_regenerate` only for targeted subsets.

Specific words:

```powershell
node scripts/admin/backfill-vocab-content.js `
  --execute `
  --write `
  --mode full_regenerate `
  --words prudent,imprudent `
  --translation-language ru
```

Specific shared rows:

```powershell
node scripts/admin/backfill-vocab-content.js `
  --execute `
  --write `
  --mode full_regenerate `
  --ids <dictionary-cache-id-1>,<dictionary-cache-id-2>
```

Broad full regenerate is blocked unless explicitly confirmed:

```powershell
node scripts/admin/backfill-vocab-content.js `
  --execute `
  --write `
  --mode full_regenerate `
  --all-candidates `
  --limit 25 `
  --confirm-full-regenerate
```

## Safe Rollout Order

1. Run the quality audit first.

```powershell
node scripts/admin/audit-vocab-content-quality.js --limit 1000 --output docs/vocab-content-quality-report.md
```

2. Plan missing-field candidates without AI.

```powershell
node scripts/admin/backfill-vocab-content.js --missing translation_word,core_meaning --limit 25
```

3. Run an API dry run for a tiny batch.

```powershell
node scripts/admin/backfill-vocab-content.js --execute --missing translation_word,core_meaning --limit 5
```

4. Write a tiny batch.

```powershell
node scripts/admin/backfill-vocab-content.js --execute --write --missing translation_word,core_meaning --limit 5
```

5. Re-run the quality audit.

6. Increase to 25, then 50, then 100 only if failures are explainable.

## Failure Review

The script prints grouped API results:

- `totalCandidates`
- `generated`
- `fixed`
- `skipped`
- `failed`
- `saved`

The underlying API response also includes per-item details:

- `word`
- `canonicalLemma`
- `issues`
- `repairFields`
- `error`

Use JSON output when reviewing failures:

```powershell
node scripts/admin/backfill-vocab-content.js `
  --execute `
  --missing translation_word,core_meaning `
  --limit 10 `
  --json-output tmp/vocab-backfill-result.json
```

Common blockers:

- `translation_word` is too long or identical to `translation_meaning`
- `core_meaning` is missing or too verbose
- `example_sentence` does not contain the target word
- the app server is not running for `--execute`
- Supabase env vars are missing

## Safety Notes

- `--write` requires `--execute`.
- Without `--execute`, no AI call is made.
- With `--execute` but without `--write`, AI may be called but Supabase is not mutated.
- Broad `full_regenerate` requires `--confirm-full-regenerate`.
- The script never deletes content.
- Student-specific progress is not modified.
- Shared global content remains the only write target through the existing bulk API.
