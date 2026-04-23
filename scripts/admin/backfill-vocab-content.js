#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_GENERATION_VERSION = 2;
const DEFAULT_TRANSLATION_LANGUAGE = "ru";
const DEFAULT_SOURCE_LANGUAGE = "en";
const DEFAULT_CONTENT_PROFILE = "sat_core_v1";
const DEFAULT_MISSING_FIELDS = ["translation_word", "core_meaning", "example_sentence"];
const BACKFILL_FIELDS = [
  "core_meaning",
  "definition",
  "translation_word",
  "translation_meaning",
  "synonyms",
  "antonyms",
  "example_sentence",
  "example_translation",
  "audio_text",
  "part_of_speech",
];
const GLOBAL_SELECT = [
  "id",
  "item_text",
  "item_type",
  "canonical_lemma",
  "source_language",
  "translation_language",
  "content_profile",
  "generation_version",
  "prompt_version",
  "generation_model",
  "refreshed_at",
  "core_meaning",
  "definition",
  "translation_word",
  "translation_meaning",
  "synonyms",
  "antonyms",
  "example_sentence",
  "example_translation",
  "audio_text",
  "part_of_speech",
  "created_at",
  "updated_at",
].join(", ");
const STUDENT_SELECT = [
  "id",
  "item_text",
  "item_type",
  "canonical_lemma",
  "global_content_id",
  "translation_language",
  "core_meaning",
  "definition",
  "translation_word",
  "translation_meaning",
  "synonyms",
  "antonyms",
  "example_sentence",
  "example_translation",
  "audio_text",
  "part_of_speech",
  "created_at",
].join(", ");

function printHelp() {
  console.log(`Usage:
  node scripts/admin/backfill-vocab-content.js [options]

Safe defaults:
  - Plans candidates only.
  - Does not call AI.
  - Does not write Supabase.
  - Selects rows missing translation_word, core_meaning, or example_sentence.

Selection:
  --missing translation_word,core_meaning   Select global rows missing any listed field.
  --fields translation_word,core_meaning    Alias for --missing.
  --outdated                                Select rows with generation_version below target.
  --generation-version 2                    Target generation version for --outdated.
  --ids id1,id2                             Specific vocabulary_dictionary_cache row IDs.
  --vocabulary-ids id1,id2                  Specific vocabulary_item_details IDs.
  --words prudent,imprudent                 Explicit words to generate/backfill.
  --translation-language ru                 Target language. Default: ru.
  --source-language en                      Global content source language. Default: en.
  --content-profile sat_core_v1             Global content profile. Default: sat_core_v1.
  --limit 50                                Max candidates. Default: 50.
  --batch-size 25                           API batch size. Default: 50.
  --all-candidates                          Do not apply default missing-field filter.

Execution:
  --execute                                 Call existing /api/admin/vocabulary/bulk-generate.
  --write                                   Save valid content. Requires --execute.
  --mode repair_missing                     Default, safest mode.
  --mode full_regenerate                    Regenerate selected content.
  --confirm-full-regenerate                 Required for broad full_regenerate.
  --api-url http://localhost:3000           App server URL for --execute.

Output:
  --json-output tmp/backfill-plan.json      Write a structured plan/result file.
  --help                                    Show this message.

Examples:
  node scripts/admin/backfill-vocab-content.js --missing translation_word,core_meaning --limit 25
  node scripts/admin/backfill-vocab-content.js --execute --missing translation_word --limit 10
  node scripts/admin/backfill-vocab-content.js --execute --write --vocabulary-ids <id1>,<id2>
`);
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    missingFields: null,
    outdated: false,
    generationVersion: DEFAULT_GENERATION_VERSION,
    ids: [],
    vocabularyIds: [],
    words: [],
    translationLanguage: DEFAULT_TRANSLATION_LANGUAGE,
    sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
    contentProfile: DEFAULT_CONTENT_PROFILE,
    limit: 50,
    batchSize: 50,
    allCandidates: false,
    execute: false,
    write: false,
    mode: "repair_missing",
    confirmFullRegenerate: false,
    apiUrl: DEFAULT_API_URL,
    jsonOutput: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if ((arg === "--missing" || arg === "--fields") && next) {
      args.missingFields = parseCsv(next);
      index += 1;
    } else if (arg === "--outdated") {
      args.outdated = true;
    } else if (arg === "--generation-version" && next) {
      args.generationVersion = Number(next);
      index += 1;
    } else if (arg === "--ids" && next) {
      args.ids = parseCsv(next);
      index += 1;
    } else if (arg === "--vocabulary-ids" && next) {
      args.vocabularyIds = parseCsv(next);
      index += 1;
    } else if (arg === "--words" && next) {
      args.words = parseCsv(next);
      index += 1;
    } else if (arg === "--translation-language" && next) {
      args.translationLanguage = next.trim() || DEFAULT_TRANSLATION_LANGUAGE;
      index += 1;
    } else if (arg === "--source-language" && next) {
      args.sourceLanguage = next.trim() || DEFAULT_SOURCE_LANGUAGE;
      index += 1;
    } else if (arg === "--content-profile" && next) {
      args.contentProfile = next.trim() || DEFAULT_CONTENT_PROFILE;
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number(next);
      index += 1;
    } else if (arg === "--batch-size" && next) {
      args.batchSize = Number(next);
      index += 1;
    } else if (arg === "--all-candidates") {
      args.allCandidates = true;
    } else if (arg === "--execute") {
      args.execute = true;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "--mode" && next) {
      args.mode = next === "full_regenerate" ? "full_regenerate" : "repair_missing";
      index += 1;
    } else if (arg === "--confirm-full-regenerate") {
      args.confirmFullRegenerate = true;
    } else if (arg === "--api-url" && next) {
      args.apiUrl = next.replace(/\/+$/, "") || DEFAULT_API_URL;
      index += 1;
    } else if (arg === "--json-output" && next) {
      args.jsonOutput = path.resolve(REPO_ROOT, next);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  args.limit = Number.isFinite(args.limit) && args.limit > 0 ? Math.floor(args.limit) : 50;
  args.batchSize =
    Number.isFinite(args.batchSize) && args.batchSize > 0
      ? Math.min(100, Math.floor(args.batchSize))
      : 50;
  args.generationVersion =
    Number.isFinite(args.generationVersion) && args.generationVersion > 0
      ? Math.floor(args.generationVersion)
      : DEFAULT_GENERATION_VERSION;

  const invalidFields = (args.missingFields ?? []).filter(
    (field) => !BACKFILL_FIELDS.includes(field)
  );
  if (invalidFields.length > 0) {
    throw new Error(`Unsupported field(s): ${invalidFields.join(", ")}`);
  }

  if (args.write && !args.execute) {
    throw new Error("--write requires --execute.");
  }

  const broadSelection =
    args.ids.length === 0 && args.vocabularyIds.length === 0 && args.words.length === 0;
  if (
    args.mode === "full_regenerate" &&
    broadSelection &&
    !args.confirmFullRegenerate
  ) {
    throw new Error(
      "Broad full_regenerate requires --confirm-full-regenerate. Prefer --ids, --words, or --vocabulary-ids."
    );
  }

  return args;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadEnvironment() {
  loadEnvFile(path.join(REPO_ROOT, ".env.local"));
  loadEnvFile(path.join(REPO_ROOT, ".env"));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function hasText(value) {
  return normalizeText(value).length > 0;
}

function hasArrayValue(value) {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function isMissingField(row, field) {
  if (field === "synonyms" || field === "antonyms") {
    return !hasArrayValue(row[field]);
  }

  return !hasText(row[field]);
}

function missingFieldsForRow(row, fields) {
  return fields.filter((field) => isMissingField(row, field));
}

function isOutdated(row, targetVersion) {
  return Number(row.generation_version ?? 0) < targetVersion;
}

function normalizeCandidate(candidate) {
  return {
    id: candidate.id ?? null,
    vocabularyItemId: candidate.vocabularyItemId ?? null,
    word: normalizeText(candidate.word ?? candidate.item_text),
    itemType: candidate.item_type === "phrase" ? "phrase" : "word",
    canonicalLemma: normalizeText(candidate.canonical_lemma),
    translationLanguage:
      normalizeText(candidate.translation_language) || DEFAULT_TRANSLATION_LANGUAGE,
    sourceLanguage: normalizeText(candidate.source_language) || DEFAULT_SOURCE_LANGUAGE,
    contentProfile: normalizeText(candidate.content_profile) || DEFAULT_CONTENT_PROFILE,
    reasons: candidate.reasons ?? [],
    missingFields: candidate.missingFields ?? [],
    generationVersion: Number(candidate.generation_version ?? 0) || null,
  };
}

function dedupeCandidates(candidates) {
  const deduped = new Map();
  for (const candidate of candidates.map(normalizeCandidate)) {
    if (!candidate.word && !candidate.vocabularyItemId) continue;
    const key = [
      candidate.id ?? "",
      candidate.vocabularyItemId ?? "",
      candidate.word.toLowerCase(),
      candidate.translationLanguage,
      candidate.sourceLanguage,
      candidate.contentProfile,
    ].join("|");
    const existing = deduped.get(key);
    if (existing) {
      deduped.set(key, {
        ...existing,
        reasons: Array.from(new Set([...existing.reasons, ...candidate.reasons])),
        missingFields: Array.from(
          new Set([...existing.missingFields, ...candidate.missingFields])
        ),
      });
    } else {
      deduped.set(key, candidate);
    }
  }
  return Array.from(deduped.values());
}

async function fetchGlobalRowsByIds(supabase, ids) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("vocabulary_dictionary_cache")
    .select(GLOBAL_SELECT)
    .in("id", ids);
  if (error) throw new Error(`Failed to fetch global IDs: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    reasons: ["explicit_global_id"],
    missingFields: [],
  }));
}

async function fetchStudentRowsByIds(supabase, ids) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("vocabulary_item_details")
    .select(STUDENT_SELECT)
    .in("id", ids);
  if (error) throw new Error(`Failed to fetch vocabulary IDs: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    vocabularyItemId: row.id,
    reasons: ["explicit_vocabulary_item_id"],
    missingFields: [],
  }));
}

async function fetchFilteredGlobalRows(supabase, args) {
  if (
    args.ids.length > 0 ||
    args.vocabularyIds.length > 0 ||
    args.words.length > 0
  ) {
    return [];
  }

  const missingFields =
    args.allCandidates || args.outdated
      ? args.missingFields ?? []
      : args.missingFields ?? DEFAULT_MISSING_FIELDS;
  const shouldApplyMissingFilter = missingFields.length > 0 && !args.allCandidates;
  const shouldApplyOutdatedFilter = Boolean(args.outdated);

  let query = supabase
    .from("vocabulary_dictionary_cache")
    .select(GLOBAL_SELECT)
    .eq("translation_language", args.translationLanguage)
    .eq("source_language", args.sourceLanguage)
    .eq("content_profile", args.contentProfile)
    .order("refreshed_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(args.limit * 4, args.limit));

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch global rows: ${error.message}`);

  return (data ?? [])
    .map((row) => {
      const missing = missingFieldsForRow(row, missingFields);
      const reasons = [];
      if (missing.length > 0) reasons.push(`missing:${missing.join(",")}`);
      if (shouldApplyOutdatedFilter && isOutdated(row, args.generationVersion)) {
        reasons.push(`outdated_generation_version:${row.generation_version ?? "null"}`);
      }
      return { ...row, reasons, missingFields: missing };
    })
    .filter((row) => {
      if (args.allCandidates) return true;
      const missingMatch = shouldApplyMissingFilter && row.missingFields.length > 0;
      const outdatedMatch =
        shouldApplyOutdatedFilter && isOutdated(row, args.generationVersion);
      return missingMatch || outdatedMatch;
    })
    .slice(0, args.limit);
}

function explicitWordCandidates(words, args) {
  return words.map((word) => ({
    word,
    item_type: word.includes(" ") ? "phrase" : "word",
    translation_language: args.translationLanguage,
    source_language: args.sourceLanguage,
    content_profile: args.contentProfile,
    reasons: ["explicit_word"],
    missingFields: [],
  }));
}

async function selectCandidates(supabase, args) {
  const [globalByIds, studentByIds, filteredGlobalRows] = await Promise.all([
    fetchGlobalRowsByIds(supabase, args.ids),
    fetchStudentRowsByIds(supabase, args.vocabularyIds),
    fetchFilteredGlobalRows(supabase, args),
  ]);
  const explicitWords = explicitWordCandidates(args.words, args);
  return dedupeCandidates([
    ...globalByIds,
    ...studentByIds,
    ...filteredGlobalRows,
    ...explicitWords,
  ]).slice(0, args.limit);
}

function groupForApi(candidates, args) {
  const groups = new Map();

  for (const candidate of candidates) {
    const key = [
      candidate.translationLanguage,
      candidate.sourceLanguage,
      candidate.contentProfile,
    ].join("|");
    const group =
      groups.get(key) ??
      {
        translationLanguage: candidate.translationLanguage,
        sourceLanguage: candidate.sourceLanguage,
        contentProfile: candidate.contentProfile,
        words: [],
        vocabularyItemIds: [],
        candidates: [],
        warnings: [],
      };

    if (candidate.vocabularyItemId) {
      group.vocabularyItemIds.push(candidate.vocabularyItemId);
    } else if (candidate.word) {
      group.words.push(candidate.word);
    }
    group.candidates.push(candidate);

    if (
      candidate.sourceLanguage !== DEFAULT_SOURCE_LANGUAGE ||
      candidate.contentProfile !== DEFAULT_CONTENT_PROFILE
    ) {
      group.warnings.push(
        `Existing bulk API uses default source/profile; candidate ${candidate.id ?? candidate.word} is ${candidate.sourceLanguage}/${candidate.contentProfile}.`
      );
    }

    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    words: Array.from(new Set(group.words)),
    vocabularyItemIds: Array.from(new Set(group.vocabularyItemIds)),
    warnings: Array.from(new Set(group.warnings)),
    payload: {
      words: Array.from(new Set(group.words)),
      vocabularyItemIds: Array.from(new Set(group.vocabularyItemIds)),
      translationLanguage: group.translationLanguage,
      batchSize: args.batchSize,
      limit: group.candidates.length,
      dryRun: !args.write,
      mode: args.mode,
    },
  }));
}

function summarizeCandidates(candidates) {
  const reasonCounts = new Map();
  const missingCounts = new Map();
  const languageCounts = new Map();

  for (const candidate of candidates) {
    for (const reason of candidate.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    for (const field of candidate.missingFields) {
      missingCounts.set(field, (missingCounts.get(field) ?? 0) + 1);
    }
    languageCounts.set(
      candidate.translationLanguage,
      (languageCounts.get(candidate.translationLanguage) ?? 0) + 1
    );
  }

  const toSortedEntries = (map) =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));

  return {
    total: candidates.length,
    reasonCounts: toSortedEntries(reasonCounts),
    missingCounts: toSortedEntries(missingCounts),
    languageCounts: toSortedEntries(languageCounts),
    sample: candidates.slice(0, 12).map((candidate) => ({
      id: candidate.id,
      vocabularyItemId: candidate.vocabularyItemId,
      word: candidate.word,
      translationLanguage: candidate.translationLanguage,
      reasons: candidate.reasons,
      missingFields: candidate.missingFields,
      generationVersion: candidate.generationVersion,
    })),
  };
}

async function callBulkGenerateApi(args, groups) {
  const results = [];
  for (const group of groups) {
    const response = await fetch(`${args.apiUrl}/api/admin/vocabulary/bulk-generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "sat_admin_session=authorized",
      },
      body: JSON.stringify(group.payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `Bulk API failed for ${group.translationLanguage}: ${response.status} ${JSON.stringify(body)}`
      );
    }
    results.push({
      translationLanguage: group.translationLanguage,
      sourceLanguage: group.sourceLanguage,
      contentProfile: group.contentProfile,
      request: group.payload,
      response: body,
    });
  }
  return results;
}

function printPlan(args, summary, groups, apiResults) {
  console.log("\nVocabulary content backfill plan");
  console.log(`Mode: ${args.mode}`);
  console.log(`Planner only: ${!args.execute}`);
  console.log(`API dry-run: ${args.execute ? !args.write : "not called"}`);
  console.log(`Candidates: ${summary.total}`);
  console.log(`Batch size: ${args.batchSize}`);
  console.log(`API URL: ${args.apiUrl}`);

  console.log("\nReasons:");
  if (summary.reasonCounts.length === 0) {
    console.log("- none");
  } else {
    for (const item of summary.reasonCounts) {
      console.log(`- ${item.key}: ${item.count}`);
    }
  }

  console.log("\nMissing field counts:");
  if (summary.missingCounts.length === 0) {
    console.log("- none or explicit selection");
  } else {
    for (const item of summary.missingCounts) {
      console.log(`- ${item.key}: ${item.count}`);
    }
  }

  console.log("\nAPI groups:");
  if (groups.length === 0) {
    console.log("- no candidates");
  } else {
    for (const group of groups) {
      console.log(
        `- ${group.translationLanguage}/${group.sourceLanguage}/${group.contentProfile}: ${group.candidates.length} candidates, ${group.words.length} words, ${group.vocabularyItemIds.length} vocabulary IDs`
      );
      for (const warning of group.warnings) {
        console.log(`  warning: ${warning}`);
      }
    }
  }

  console.log("\nSample:");
  for (const item of summary.sample) {
    console.log(
      `- ${item.word || item.vocabularyItemId}: ${item.reasons.join("; ") || "selected"}`
    );
  }

  if (apiResults) {
    console.log("\nAPI results:");
    for (const result of apiResults) {
      const bulkResult = result.response?.result;
      console.log(
        `- ${result.translationLanguage}: candidates=${bulkResult?.totalCandidates ?? "?"}, generated=${bulkResult?.generated ?? "?"}, fixed=${bulkResult?.fixed ?? "?"}, skipped=${bulkResult?.skipped ?? "?"}, failed=${bulkResult?.failed ?? "?"}, saved=${bulkResult?.saved ?? "?"}`
      );
    }
  }

  if (!args.execute) {
    console.log("\nNo AI call was made. Add --execute to call the existing admin bulk API.");
  } else if (!args.write) {
    console.log("\nAI dry-run mode was used. Add --write with --execute to save valid content.");
  }
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnvironment();

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const candidates = await selectCandidates(supabase, args);
  const groups = groupForApi(candidates, args);
  const summary = summarizeCandidates(candidates);
  const apiResults = args.execute ? await callBulkGenerateApi(args, groups) : null;
  const output = {
    generatedAt: new Date().toISOString(),
    args: {
      ...args,
      jsonOutput: args.jsonOutput ? path.relative(REPO_ROOT, args.jsonOutput) : null,
    },
    summary,
    groups,
    apiResults,
  };

  printPlan(args, summary, groups, apiResults);

  if (args.jsonOutput) {
    fs.mkdirSync(path.dirname(args.jsonOutput), { recursive: true });
    fs.writeFileSync(args.jsonOutput, JSON.stringify(output, null, 2), "utf8");
    console.log(`\nWrote JSON output: ${path.relative(REPO_ROOT, args.jsonOutput)}`);
  }
}

main().catch((error) => {
  console.error("\nVocabulary content backfill failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
