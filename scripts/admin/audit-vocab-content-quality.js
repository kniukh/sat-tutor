#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "docs", "vocab-content-quality-report.md");
const TARGET_FIELDS = [
  "core_meaning",
  "definition",
  "translation_word",
  "translation_meaning",
  "synonyms",
  "antonyms",
  "example_sentence",
  "audio_text",
];

const GLOBAL_SELECT = [
  "id",
  "item_text",
  "item_type",
  "canonical_lemma",
  "translation_language",
  "content_profile",
  "english_explanation",
  "translated_explanation",
  "example_text",
  "distractors",
  "drill_answer_sets",
  "alternate_definitions",
  "synonym_candidates",
  "antonym_candidates",
  "example_sentences",
  "generation_version",
  "prompt_version",
  "generation_model",
  "refreshed_at",
  "quality_score",
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
  "lesson_id",
  "global_content_id",
  "english_explanation",
  "translated_explanation",
  "example_text",
  "context_sentence",
  "audio_status",
  "audio_url",
  "drill_answer_sets",
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
  "is_removed",
  "created_at",
].join(", ");

function parseArgs(argv) {
  const args = {
    limit: 1000,
    studentLimit: 1000,
    output: DEFAULT_OUTPUT,
    includeStudentDetails: true,
    json: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--limit" && next) {
      args.limit = Number(next);
      index += 1;
    } else if (arg === "--student-limit" && next) {
      args.studentLimit = Number(next);
      index += 1;
    } else if (arg === "--output" && next) {
      args.output = path.resolve(REPO_ROOT, next);
      index += 1;
    } else if (arg === "--no-student-details") {
      args.includeStudentDetails = false;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/admin/audit-vocab-content-quality.js --limit 1000 --output docs/vocab-content-quality-report.md");
      process.exit(0);
    }
  }
  args.limit = Number.isFinite(args.limit) && args.limit > 0 ? Math.floor(args.limit) : 1000;
  args.studentLimit =
    Number.isFinite(args.studentLimit) && args.studentLimit >= 0
      ? Math.floor(args.studentLimit)
      : 1000;
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function comparable(value) {
  return normalizeText(value).toLowerCase();
}

function hasText(value) {
  return normalizeText(value).length > 0;
}

function asArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map(normalizeText)
    : [];
}

function tokenCount(value) {
  const text = normalizeText(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function answerSet(row, key) {
  const sets = parseJsonObject(row.drill_answer_sets);
  const value = sets[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function answerSetMeta(row) {
  const meta = parseJsonObject(row.drill_answer_sets).__meta__;
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
}

function answerSetHasDistractors(row, key, min = 3) {
  const set = answerSet(row, key);
  return Boolean(set?.drill_correct_answer) && asArray(set?.distractors).length >= min;
}

function firstText(values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function strongStoredTranslationWord(row) {
  const candidate = normalizeText(answerSet(row, "translation_english_to_native")?.drill_correct_answer);
  if (!candidate) return "";
  if (
    comparable(candidate) === comparable(row.item_text) ||
    comparable(candidate) === comparable(row.english_explanation) ||
    tokenCount(candidate) > 6
  ) {
    return "";
  }
  return candidate;
}

function resolvedCoreMeaning(row) {
  const meta = answerSetMeta(row);
  return firstText([
    row.core_meaning,
    meta.refined_definition,
    asArray(row.alternate_definitions)[0],
    row.english_explanation,
  ]);
}

function resolvedTranslationWord(row) {
  return firstText([row.translation_word, strongStoredTranslationWord(row)]);
}

function resolvedTranslationMeaning(row) {
  return firstText([row.translation_meaning, row.translated_explanation]);
}

function resolvedExampleSentence(row) {
  const meta = answerSetMeta(row);
  return firstText([
    row.example_sentence,
    meta.practice_example_sentence,
    row.example_text,
    asArray(row.example_sentences)[0],
  ]);
}

function resolvedAudioText(row) {
  return firstText([row.audio_text, row.item_text]);
}

function containsTarget(sentence, target) {
  const source = comparable(sentence);
  const targetText = comparable(target);
  if (!source || !targetText) return false;
  if (source.includes(targetText)) return true;
  const simpleBase = targetText.replace(/(?:ing|ed|s)$/i, "");
  return simpleBase.length >= 4 ? source.includes(simpleBase) : false;
}

function hasSuspiciousCharacters(value) {
  const text = normalizeText(value);
  return Boolean(text) && (/[\uFFFD�{}[\]|<>_=]{1,}/.test(text) || /[A-Za-z]{20,}/.test(text));
}

function isConciseTranslationWord(value) {
  const text = normalizeText(value);
  return Boolean(text) && tokenCount(text) <= 4 && text.length <= 56 && !hasSuspiciousCharacters(text);
}

function isConciseMeaning(value) {
  const text = normalizeText(value);
  return Boolean(text) && tokenCount(text) <= 10 && text.length <= 90 && !hasSuspiciousCharacters(text);
}

function isUsableDefinition(value) {
  const text = normalizeText(value);
  return Boolean(text) && tokenCount(text) <= 45 && text.length <= 320 && !hasSuspiciousCharacters(text);
}

function fieldPresent(row, field) {
  if (field === "synonyms" || field === "antonyms") return asArray(row[field]).length > 0;
  return hasText(row[field]);
}

function resolvedFieldPresent(row, field) {
  if (field === "core_meaning") return hasText(resolvedCoreMeaning(row));
  if (field === "translation_word") return hasText(resolvedTranslationWord(row));
  if (field === "translation_meaning") return hasText(resolvedTranslationMeaning(row));
  if (field === "example_sentence") return hasText(resolvedExampleSentence(row));
  if (field === "audio_text") return hasText(resolvedAudioText(row));
  if (field === "synonyms") return asArray(row.synonyms).length > 0 || asArray(row.synonym_candidates).length > 0;
  if (field === "antonyms") return asArray(row.antonyms).length > 0 || asArray(row.antonym_candidates).length > 0;
  if (field === "definition") return hasText(row.definition) || hasText(row.english_explanation);
  return fieldPresent(row, field);
}

function readinessForRow(row) {
  const word = normalizeText(row.item_text);
  const audioText = resolvedAudioText(row);
  const coreMeaning = resolvedCoreMeaning(row);
  const translationWord = resolvedTranslationWord(row);
  const exampleSentence = resolvedExampleSentence(row);
  return {
    groupedAudioTranslation:
      hasText(audioText) &&
      isConciseTranslationWord(translationWord) &&
      comparable(translationWord) !== comparable(word),
    groupedAudioEnglish: hasText(audioText) && hasText(word),
    groupedAudioMeaning: hasText(audioText) && isConciseMeaning(coreMeaning),
    pairMatchWordTranslation:
      hasText(word) &&
      isConciseTranslationWord(translationWord) &&
      comparable(translationWord) !== comparable(word),
    translationMatch:
      isConciseTranslationWord(translationWord) &&
      (answerSetHasDistractors(row, "translation_english_to_native") ||
        answerSetHasDistractors(row, "translation_native_to_english")),
    contextMeaning:
      hasText(exampleSentence) &&
      containsTarget(exampleSentence, word) &&
      isConciseMeaning(coreMeaning) &&
      answerSetHasDistractors(row, "context_meaning"),
  };
}

function auditRow(row) {
  const issues = [];
  const word = normalizeText(row.item_text);
  const coreMeaning = resolvedCoreMeaning(row);
  const translationWord = resolvedTranslationWord(row);
  const translationMeaning = resolvedTranslationMeaning(row);
  const definition = firstText([row.definition, row.english_explanation]);
  const exampleSentence = resolvedExampleSentence(row);
  const audioText = resolvedAudioText(row);
  const synonyms = asArray(row.synonyms);
  const antonyms = asArray(row.antonyms);

  for (const field of TARGET_FIELDS) {
    if (!fieldPresent(row, field)) issues.push(`missing_${field}`);
  }
  if (coreMeaning && !isConciseMeaning(coreMeaning)) issues.push("core_meaning_too_long_or_noisy");
  if (definition && !isUsableDefinition(definition)) issues.push("definition_too_long_or_noisy");
  if (translationWord && !isConciseTranslationWord(translationWord)) issues.push("translation_word_too_long_or_noisy");
  if (translationWord && translationMeaning && comparable(translationWord) === comparable(translationMeaning)) {
    issues.push("translation_word_identical_to_translation_meaning");
  }
  if (translationWord && word && comparable(translationWord) === comparable(word)) {
    issues.push("translation_word_identical_to_word");
  }
  if (row.core_meaning && row.definition && comparable(row.core_meaning) === comparable(row.definition)) {
    issues.push("core_meaning_identical_to_definition");
  }
  if (exampleSentence && !containsTarget(exampleSentence, word)) {
    issues.push("example_sentence_missing_target_word");
  }
  if (audioText && tokenCount(audioText) > 6) issues.push("audio_text_too_long");
  if (synonyms.some((value) => comparable(value) === comparable(word))) issues.push("synonyms_include_target_word");
  if (antonyms.some((value) => comparable(value) === comparable(word))) issues.push("antonyms_include_target_word");
  if (hasSuspiciousCharacters(translationWord)) issues.push("translation_word_suspicious_characters");
  if (hasSuspiciousCharacters(translationMeaning)) issues.push("translation_meaning_suspicious_characters");
  if (hasSuspiciousCharacters(coreMeaning)) issues.push("core_meaning_suspicious_characters");

  const readiness = readinessForRow(row);
  const criticalIssues = issues.filter((issue) =>
    [
      "missing_core_meaning",
      "missing_definition",
      "missing_translation_word",
      "missing_translation_meaning",
      "missing_example_sentence",
      "translation_word_too_long_or_noisy",
      "translation_word_identical_to_translation_meaning",
      "translation_word_identical_to_word",
      "core_meaning_too_long_or_noisy",
      "example_sentence_missing_target_word",
    ].includes(issue)
  );

  let recommendation = "acceptable_as_is";
  if (!readiness.groupedAudioTranslation && !readiness.groupedAudioMeaning && !readiness.translationMatch && criticalIssues.length >= 3) {
    recommendation = "regenerate";
  } else if (issues.length > 0) {
    recommendation = "repair";
  }

  return {
    id: row.id,
    word,
    language: normalizeText(row.translation_language) || "unknown",
    canonicalLemma: normalizeText(row.canonical_lemma),
    issues,
    readiness,
    recommendation,
    fields: { coreMeaning, definition, translationWord, translationMeaning, exampleSentence, audioText },
    raw: row,
  };
}

async function fetchRows(supabase, table, select, limit) {
  const { count, error: countError } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (countError) throw new Error(`${table} count failed: ${countError.message}`);

  const rows = [];
  const pageSize = Math.min(1000, Math.max(1, limit));
  for (let offset = 0; offset < limit; offset += pageSize) {
    const end = Math.min(offset + pageSize - 1, limit - 1);
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order("created_at", { ascending: false })
      .range(offset, end);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return { totalCount: count ?? rows.length, rows };
}

function percent(count, total) {
  return total ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function summarizeCoverage(rows) {
  const coverage = {};
  for (const field of TARGET_FIELDS) {
    const actualCount = rows.filter((row) => fieldPresent(row, field)).length;
    const resolvedCount = rows.filter((row) => resolvedFieldPresent(row, field)).length;
    coverage[field] = {
      actualCount,
      actualPercent: percent(actualCount, rows.length),
      resolvedCount,
      resolvedPercent: percent(resolvedCount, rows.length),
    };
  }
  return coverage;
}

function summarizeIssues(auditedRows) {
  const counts = new Map();
  for (const row of auditedRows) {
    for (const issue of row.issues) counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([issue, count]) => ({ issue, count, percent: percent(count, auditedRows.length) }))
    .sort((a, b) => b.count - a.count || a.issue.localeCompare(b.issue));
}

function blockerReasonsForRow(row, key) {
  const reasons = [];
  const word = row.word;
  const coreMeaning = row.fields.coreMeaning;
  const translationWord = row.fields.translationWord;
  const exampleSentence = row.fields.exampleSentence;
  const audioText = row.fields.audioText;
  if (key.startsWith("groupedAudio") && !hasText(audioText)) reasons.push("missing_audio_text_or_word");
  if (["groupedAudioTranslation", "pairMatchWordTranslation", "translationMatch"].includes(key)) {
    if (!hasText(translationWord)) reasons.push("missing_translation_word");
    if (translationWord && !isConciseTranslationWord(translationWord)) reasons.push("translation_word_not_concise");
    if (translationWord && comparable(translationWord) === comparable(word)) reasons.push("translation_word_equals_word");
  }
  if (key === "translationMatch") {
    if (!answerSetHasDistractors(row.raw, "translation_english_to_native") && !answerSetHasDistractors(row.raw, "translation_native_to_english")) {
      reasons.push("missing_translation_answer_set_distractors");
    }
  }
  if (key === "groupedAudioMeaning" || key === "contextMeaning") {
    if (!hasText(coreMeaning)) reasons.push("missing_core_meaning");
    if (coreMeaning && !isConciseMeaning(coreMeaning)) reasons.push("core_meaning_not_concise");
  }
  if (key === "contextMeaning") {
    if (!hasText(exampleSentence)) reasons.push("missing_example_sentence");
    if (exampleSentence && !containsTarget(exampleSentence, word)) reasons.push("example_sentence_missing_target_word");
    if (!answerSetHasDistractors(row.raw, "context_meaning")) reasons.push("missing_context_meaning_answer_set_distractors");
  }
  return reasons.length ? reasons : ["other"];
}

function readinessBlockers(auditedRows, key) {
  const blockers = new Map();
  for (const row of auditedRows) {
    if (row.readiness[key]) continue;
    for (const reason of blockerReasonsForRow(row, key)) {
      blockers.set(reason, (blockers.get(reason) ?? 0) + 1);
    }
  }
  return Array.from(blockers.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, 8);
}

function summarizeReadiness(auditedRows) {
  const keys = [
    "groupedAudioTranslation",
    "groupedAudioEnglish",
    "groupedAudioMeaning",
    "pairMatchWordTranslation",
    "translationMatch",
    "contextMeaning",
  ];
  const summary = {};
  for (const key of keys) {
    const readyCount = auditedRows.filter((row) => row.readiness[key]).length;
    summary[key] = {
      readyCount,
      readyPercent: percent(readyCount, auditedRows.length),
      blockedCount: auditedRows.length - readyCount,
      blockers: readinessBlockers(auditedRows, key),
    };
  }
  return summary;
}

function summarizeRecommendations(auditedRows) {
  const counts = { regenerate: 0, repair: 0, acceptable_as_is: 0 };
  for (const row of auditedRows) counts[row.recommendation] = (counts[row.recommendation] ?? 0) + 1;
  return counts;
}

function summarizeGroupedDuplicates(rows, valueGetter) {
  const byLanguage = new Map();
  for (const row of rows) {
    const language = normalizeText(row.translation_language) || "unknown";
    const value = comparable(valueGetter(row));
    if (!value) continue;
    if (!byLanguage.has(language)) byLanguage.set(language, new Map());
    const valueCounts = byLanguage.get(language);
    valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
  }
  const duplicates = [];
  for (const [language, valueCounts] of byLanguage.entries()) {
    for (const [value, count] of valueCounts.entries()) {
      if (count > 1) duplicates.push({ language, value, count });
    }
  }
  return duplicates.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, 12);
}

function summarizeConsistency(rows) {
  const byLemma = new Map();
  for (const row of rows) {
    const key = [comparable(row.canonical_lemma || row.item_text), normalizeText(row.translation_language) || "unknown"].join("|");
    if (!byLemma.has(key)) byLemma.set(key, []);
    byLemma.get(key).push(row);
  }
  const inconsistent = [];
  for (const group of byLemma.values()) {
    if (group.length < 2) continue;
    const coreMeanings = new Set(group.map((row) => comparable(row.core_meaning)).filter(Boolean));
    const translationWords = new Set(group.map((row) => comparable(row.translation_word)).filter(Boolean));
    const definitions = new Set(group.map((row) => comparable(row.definition)).filter(Boolean));
    if (coreMeanings.size > 1 || translationWords.size > 1 || definitions.size > 1) {
      inconsistent.push({
        lemma: normalizeText(group[0].canonical_lemma || group[0].item_text),
        language: normalizeText(group[0].translation_language) || "unknown",
        rowCount: group.length,
        coreMeaningVariants: coreMeanings.size,
        translationWordVariants: translationWords.size,
        definitionVariants: definitions.size,
      });
    }
  }
  return inconsistent.sort((a, b) => b.rowCount - a.rowCount).slice(0, 12);
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
  ].join("\n");
}

function bulletList(items, fallback = "- None found") {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

function renderReport(result) {
  const coverageRows = TARGET_FIELDS.map((field) => [
    field,
    `${result.coverage[field].actualPercent}% (${result.coverage[field].actualCount}/${result.globalRows.length})`,
    `${result.coverage[field].resolvedPercent}% (${result.coverage[field].resolvedCount}/${result.globalRows.length})`,
  ]);
  const readinessRows = Object.entries(result.readiness).map(([exercise, value]) => [
    exercise,
    `${value.readyPercent}% (${value.readyCount}/${result.globalRows.length})`,
    value.blockers.slice(0, 3).map((item) => `${item.reason}: ${item.count}`).join("; ") || "none",
  ]);
  const issueRows = result.issueSummary.slice(0, 15).map((item) => [
    item.issue,
    item.count,
    `${item.percent}%`,
  ]);
  const exampleRows = result.problematicExamples.map((row) => [
    row.word,
    row.language,
    row.id,
    row.issues.slice(0, 6).join(", "),
  ]);
  const consistencyRows = result.consistency.map((item) => [
    item.lemma,
    item.language,
    item.rowCount,
    item.coreMeaningVariants,
    item.translationWordVariants,
    item.definitionVariants,
  ]);

  return `# Vocabulary Content Quality Report

Generated: ${result.generatedAt}

This read-only audit examines vocabulary drill content stored in Supabase. The primary dataset is \`vocabulary_dictionary_cache\`, the shared reusable content layer. A supplemental sample from \`vocabulary_item_details\` is included only for context.

## Dataset

- Global reusable rows examined: ${result.globalRows.length} of ${result.globalTotalCount}
- Student materialized rows sampled: ${result.studentRows.length} of ${result.studentTotalCount}
- Tables inspected: \`vocabulary_dictionary_cache\`, \`vocabulary_item_details\`
- Mutations performed: none

## Field Coverage

Actual coverage means the gold-content column itself is populated. Resolved coverage means backward-compatible fallback can derive a usable value from legacy fields.

${markdownTable(["Field", "Actual coverage", "Resolved/fallback coverage"], coverageRows)}

## Top Recurring Problems

${issueRows.length ? markdownTable(["Issue", "Count", "Percent"], issueRows) : "- No recurring issues found."}

## Exercise Readiness Assessment

${markdownTable(["Exercise", "Ready rows", "Top blockers"], readinessRows)}

## Grouped Drill Analysis

### Grouped audio -> translation

- Requires concise \`translation_word\` plus \`audio_text\` or \`item_text\`.
- Duplicate right-side translations can make grouped matching ambiguous.
- Duplicate translation_word values found: ${result.duplicateTranslationWords.length}

${bulletList(result.duplicateTranslationWords.slice(0, 8).map((item) => `\`${item.language}\` translation \`${item.value}\` appears ${item.count} times`))}

### Grouped audio -> English

- Requires usable \`audio_text\` or fallback to \`item_text\`.
- Structurally strongest grouped audio mode because the right side is the vocabulary word itself.

### Grouped audio -> meaning

- Requires concise \`core_meaning\`; long definitions are not suitable in fast matching UI.
- Duplicate core_meaning values found: ${result.duplicateCoreMeanings.length}

${bulletList(result.duplicateCoreMeanings.slice(0, 8).map((item) => `\`${item.language}\` meaning \`${item.value}\` appears ${item.count} times`))}

### Pair match variants

- Word -> translation should use \`translation_word\`.
- Word -> meaning should use \`core_meaning\`.
- Legacy fallback to \`translated_explanation\` or \`english_explanation\` is acceptable only when concise.

## Content Consistency

Rows below have the same lemma/language but inconsistent stored structures.

${consistencyRows.length ? markdownTable(["Lemma", "Language", "Rows", "Core meaning variants", "Translation variants", "Definition variants"], consistencyRows) : "- No inconsistent duplicate structures found in sampled rows."}

## Problematic Examples

${exampleRows.length ? markdownTable(["Word", "Language", "Record ID", "Issues"], exampleRows) : "- No problematic examples found."}

## Recommendations

### Regenerate

- Count: ${result.recommendations.regenerate}
- Use for rows where multiple critical fields are missing and neither grouped nor translation/context drills are content-ready.

### Repair

- Count: ${result.recommendations.repair}
- Use targeted repair for rows with useful legacy content but missing gold fields, especially \`translation_word\`, \`core_meaning\`, and \`example_sentence\`.

### Acceptable As-Is

- Count: ${result.recommendations.acceptable_as_is}
- Rows with no major quality issues and enough content to support live drills.

## Key Findings

- \`translation_word\` is the highest-leverage field for grouped audio -> translation and word -> translation pair match.
- \`core_meaning\` should power fast English meaning matching; long \`definition\` text should not be used in grouped cards.
- \`audio_text\` can safely fall back to \`item_text\`, but explicit coverage helps with phrases and TTS normalization.
- \`example_sentence\` is the main blocker for high-quality context meaning exercises.

## How To Re-run

\`\`\`powershell
node scripts/admin/audit-vocab-content-quality.js --limit 1000 --output docs/vocab-content-quality-report.md
\`\`\`
`;
}

function printConciseSummary(result, outputPath) {
  const worstMissingFields = Object.entries(result.coverage)
    .map(([field, stats]) => ({
      field,
      missing: result.globalRows.length - stats.actualCount,
      actualPercent: stats.actualPercent,
    }))
    .sort((a, b) => b.missing - a.missing || a.field.localeCompare(b.field))
    .slice(0, 5);
  const groupedBlockers = [
    ...result.readiness.groupedAudioTranslation.blockers.map((item) => ({ drill: "grouped audio -> translation", ...item })),
    ...result.readiness.groupedAudioMeaning.blockers.map((item) => ({ drill: "grouped audio -> meaning", ...item })),
  ].sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)).slice(0, 5);

  console.log("\nVocabulary content quality audit complete");
  console.log(`Report: ${path.relative(REPO_ROOT, outputPath)}`);
  console.log(`Global rows examined: ${result.globalRows.length}/${result.globalTotalCount}`);
  console.log("\nCoverage:");
  for (const field of TARGET_FIELDS) {
    const stats = result.coverage[field];
    console.log(`- ${field}: ${stats.actualPercent}% actual, ${stats.resolvedPercent}% with fallback`);
  }
  console.log("\nWorst missing fields:");
  for (const item of worstMissingFields) {
    console.log(`- ${item.field}: ${item.missing} missing (${item.actualPercent}% coverage)`);
  }
  console.log("\nTop readiness blockers for grouped drills:");
  for (const blocker of groupedBlockers) {
    console.log(`- ${blocker.drill}: ${blocker.reason} (${blocker.count})`);
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

  const globalResult = await fetchRows(
    supabase,
    "vocabulary_dictionary_cache",
    GLOBAL_SELECT,
    args.limit
  );
  let studentResult = { totalCount: 0, rows: [] };
  if (args.includeStudentDetails && args.studentLimit > 0) {
    studentResult = await fetchRows(
      supabase,
      "vocabulary_item_details",
      STUDENT_SELECT,
      args.studentLimit
    );
  }

  const auditedRows = globalResult.rows.map(auditRow);
  const result = {
    generatedAt: new Date().toISOString(),
    globalTotalCount: globalResult.totalCount,
    globalRows: globalResult.rows,
    studentTotalCount: studentResult.totalCount,
    studentRows: studentResult.rows,
    coverage: summarizeCoverage(globalResult.rows),
    issueSummary: summarizeIssues(auditedRows),
    readiness: summarizeReadiness(auditedRows),
    recommendations: summarizeRecommendations(auditedRows),
    duplicateTranslationWords: summarizeGroupedDuplicates(globalResult.rows, resolvedTranslationWord),
    duplicateCoreMeanings: summarizeGroupedDuplicates(globalResult.rows, resolvedCoreMeaning),
    consistency: summarizeConsistency(globalResult.rows),
    problematicExamples: auditedRows
      .filter((row) => row.issues.length > 0)
      .sort((a, b) => b.issues.length - a.issues.length || a.word.localeCompare(b.word))
      .slice(0, 15),
  };

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, renderReport(result), "utf8");
  printConciseSummary(result, args.output);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error("Vocabulary content quality audit failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
