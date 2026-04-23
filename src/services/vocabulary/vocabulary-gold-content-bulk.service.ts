import { AI_MODELS } from "@/services/ai/ai-models";
import {
  VOCABULARY_GOLD_CONTENT_PROMPT_VERSION,
  generateVocabularyGoldContentBatch,
  repairVocabularyGoldContentBatch,
} from "@/services/ai/generate-vocabulary-gold-content-bulk";
import { createClient } from "@/lib/supabase/server";
import {
  CURRENT_VOCABULARY_CONTENT_GENERATION_VERSION,
  CURRENT_VOCABULARY_CONTENT_PROMPT_VERSION,
  DEFAULT_VOCABULARY_CONTENT_PROFILE,
  DEFAULT_VOCABULARY_SOURCE_LANGUAGE,
  buildVocabularyDictionaryCacheKey,
  listVocabularyDictionaryCacheEntries,
  upsertVocabularyDictionaryCacheEntries,
  type VocabularyDictionaryCacheEntry,
} from "@/services/vocabulary/vocabulary-dictionary-cache.service";
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";
import {
  getRepairableVocabularyGoldContentFields,
  mergeVocabularyGoldContentRepair,
  sanitizeVocabularyGoldContentRecord,
  validateVocabularyGoldContent,
  type VocabularyGoldContentRecord,
  type VocabularyGoldContentValidationIssue,
} from "@/services/vocabulary/vocabulary-gold-content-validation.service";

type VocabularyItemCandidateRow = {
  id: string;
  item_text: string;
  item_type?: string | null;
  canonical_lemma?: string | null;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  core_meaning?: string | null;
  definition?: string | null;
  translation_word?: string | null;
  translation_meaning?: string | null;
  synonyms?: string[] | null;
  antonyms?: string[] | null;
  example_sentence?: string | null;
  example_translation?: string | null;
  audio_text?: string | null;
  part_of_speech?: string | null;
};

type BulkCandidate = {
  word: string;
  itemType: "word" | "phrase";
  canonicalLemma: string;
  translationLanguage: string;
  sourceLanguage: string;
  contentProfile: string;
  existingEntry: VocabularyDictionaryCacheEntry | null;
  hint?: VocabularyItemCandidateRow | null;
};

export type VocabularyGoldContentBulkMode = "repair_missing" | "full_regenerate";

export type VocabularyGoldContentBulkParams = {
  words?: string[];
  vocabularyItemIds?: string[];
  translationLanguage?: string | null;
  batchSize?: number | null;
  limit?: number | null;
  dryRun?: boolean | null;
  mode?: VocabularyGoldContentBulkMode | null;
};

export type VocabularyGoldContentBulkItemResult = {
  word: string;
  canonicalLemma: string;
  status: "generated" | "fixed" | "skipped" | "failed";
  dryRun: boolean;
  saved: boolean;
  issues: VocabularyGoldContentValidationIssue[];
  repairFields: string[];
  error?: string;
};

export type VocabularyGoldContentBulkResult = {
  dryRun: boolean;
  mode: VocabularyGoldContentBulkMode;
  batchSize: number;
  totalCandidates: number;
  generated: number;
  fixed: number;
  failed: number;
  skipped: number;
  saved: number;
  batches: Array<{
    index: number;
    candidateCount: number;
    generated: number;
    fixed: number;
    failed: number;
    skipped: number;
    saved: number;
  }>;
  items: VocabularyGoldContentBulkItemResult[];
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function normalizeKey(value: string) {
  return normalizeText(value).toLowerCase();
}

function normalizeItemType(value: string | null | undefined, itemText: string): "word" | "phrase" {
  return value === "phrase" || itemText.includes(" ") ? "phrase" : "word";
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function contentFromEntry(entry: VocabularyDictionaryCacheEntry): VocabularyGoldContentRecord {
  return sanitizeVocabularyGoldContentRecord({
    word: entry.itemText,
    part_of_speech: entry.partOfSpeech,
    core_meaning: entry.coreMeaning,
    definition: entry.definition ?? entry.englishExplanation,
    translation_word: entry.translationWord,
    translation_meaning: entry.translationMeaning ?? entry.translatedExplanation,
    synonyms: entry.synonyms,
    antonyms: entry.antonyms,
    example_sentence: entry.exampleSentence ?? entry.exampleText,
    example_translation: entry.exampleTranslation,
    audio_text: entry.audioText ?? entry.itemText,
  });
}

function contentFromCandidate(candidate: BulkCandidate): VocabularyGoldContentRecord {
  const hint = candidate.hint;
  return sanitizeVocabularyGoldContentRecord({
    word: candidate.word,
    part_of_speech: hint?.part_of_speech ?? null,
    core_meaning: hint?.core_meaning ?? null,
    definition: hint?.definition ?? hint?.english_explanation ?? null,
    translation_word: hint?.translation_word ?? null,
    translation_meaning: hint?.translation_meaning ?? hint?.translated_explanation ?? null,
    synonyms: hint?.synonyms ?? [],
    antonyms: hint?.antonyms ?? [],
    example_sentence: hint?.example_sentence ?? hint?.example_text ?? hint?.context_sentence ?? null,
    example_translation: hint?.example_translation ?? null,
    audio_text: hint?.audio_text ?? candidate.word,
  });
}

function shouldSkipExistingContent(candidate: BulkCandidate) {
  if (!candidate.existingEntry) {
    return false;
  }

  return validateVocabularyGoldContent(contentFromEntry(candidate.existingEntry)).isValidForSave;
}

async function loadVocabularyItemHints(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocabulary_item_details")
    .select(
      "id, item_text, item_type, canonical_lemma, english_explanation, translated_explanation, example_text, context_sentence, core_meaning, definition, translation_word, translation_meaning, synonyms, antonyms, example_sentence, example_translation, audio_text, part_of_speech"
    )
    .in("id", ids);

  if (error) {
    throw error;
  }

  return (data ?? []) as VocabularyItemCandidateRow[];
}

async function buildCandidates(params: VocabularyGoldContentBulkParams) {
  const translationLanguage = normalizeText(params.translationLanguage) || "ru";
  const sourceLanguage = DEFAULT_VOCABULARY_SOURCE_LANGUAGE;
  const contentProfile = DEFAULT_VOCABULARY_CONTENT_PROFILE;
  const requestedWords = (params.words ?? [])
    .filter((word): word is string => typeof word === "string")
    .map(normalizeText)
    .filter(Boolean);
  const itemHints = await loadVocabularyItemHints(
    (params.vocabularyItemIds ?? []).filter((id): id is string => typeof id === "string")
  );

  const candidatesByKey = new Map<string, BulkCandidate>();

  for (const word of requestedWords) {
    const itemType = normalizeItemType(null, word);
    const canonicalLemma = resolveVocabularyLemma({ itemText: word, itemType }).canonicalLemma;
    const key = buildVocabularyDictionaryCacheKey({
      itemText: word,
      itemType,
      canonicalLemma,
      translationLanguage,
      sourceLanguage,
      contentProfile,
    });
    candidatesByKey.set(key, {
      word,
      itemType,
      canonicalLemma,
      translationLanguage,
      sourceLanguage,
      contentProfile,
      existingEntry: null,
      hint: null,
    });
  }

  for (const hint of itemHints) {
    if (!hint.item_text) {
      continue;
    }

    const word = normalizeText(hint.item_text);
    const itemType = normalizeItemType(hint.item_type, word);
    const canonicalLemma =
      normalizeText(hint.canonical_lemma) ||
      resolveVocabularyLemma({ itemText: word, itemType }).canonicalLemma;
    const key = buildVocabularyDictionaryCacheKey({
      itemText: word,
      itemType,
      canonicalLemma,
      translationLanguage,
      sourceLanguage,
      contentProfile,
    });
    candidatesByKey.set(key, {
      word,
      itemType,
      canonicalLemma,
      translationLanguage,
      sourceLanguage,
      contentProfile,
      existingEntry: null,
      hint,
    });
  }

  let candidates = Array.from(candidatesByKey.values());
  const limit =
    typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(0, Math.floor(params.limit))
      : null;

  if (limit !== null) {
    candidates = candidates.slice(0, limit);
  }

  if (candidates.length === 0) {
    return [];
  }

  const existingEntries = await listVocabularyDictionaryCacheEntries({
    items: candidates.map((candidate) => ({
      itemText: candidate.word,
      itemType: candidate.itemType,
      canonicalLemma: candidate.canonicalLemma,
    })),
    translationLanguage,
    sourceLanguage,
    contentProfile,
  });

  return candidates.map((candidate) => {
    const key = buildVocabularyDictionaryCacheKey({
      itemText: candidate.word,
      itemType: candidate.itemType,
      canonicalLemma: candidate.canonicalLemma,
      translationLanguage: candidate.translationLanguage,
      sourceLanguage: candidate.sourceLanguage,
      contentProfile: candidate.contentProfile,
    });
    return {
      ...candidate,
      existingEntry: existingEntries.get(key) ?? null,
    };
  });
}

function seedFromContent(params: {
  candidate: BulkCandidate;
  content: VocabularyGoldContentRecord;
  issues: VocabularyGoldContentValidationIssue[];
  mode: VocabularyGoldContentBulkMode;
}) {
  const existing = params.candidate.existingEntry;
  const content = params.content;
  const nowIso = new Date().toISOString();
  const existingIngredients =
    existing?.drillIngredients && typeof existing.drillIngredients === "object"
      ? existing.drillIngredients
      : {};

  return {
    itemText: content.word,
    itemType: params.candidate.itemType,
    canonicalLemma: params.candidate.canonicalLemma,
    sourceLanguage: params.candidate.sourceLanguage,
    translationLanguage: params.candidate.translationLanguage,
    contentProfile: params.candidate.contentProfile,
    coreMeaning: content.core_meaning,
    definition: content.definition,
    translationWord: content.translation_word,
    translationMeaning: content.translation_meaning,
    synonyms: content.synonyms,
    antonyms: content.antonyms,
    exampleSentence: content.example_sentence,
    exampleTranslation: content.example_translation,
    audioText: content.audio_text ?? content.word,
    partOfSpeech: content.part_of_speech,
    englishExplanation: content.definition ?? content.core_meaning ?? existing?.englishExplanation ?? content.word,
    translatedExplanation:
      content.translation_meaning ??
      content.translation_word ??
      existing?.translatedExplanation ??
      content.word,
    exampleText: content.example_sentence ?? existing?.exampleText ?? null,
    distractors: existing?.distractors ?? [],
    drillAnswerSets: existing?.drillAnswerSets ?? {},
    alternateDefinitions: existing?.alternateDefinitions ?? [],
    synonymCandidates: content.synonyms,
    antonymCandidates: content.antonyms,
    exampleSentences: content.example_sentence ? [content.example_sentence] : existing?.exampleSentences ?? [],
    collocations: existing?.collocations ?? [],
    confusionPairs: existing?.confusionPairs ?? [],
    drillIngredients: {
      ...existingIngredients,
      bulk_gold_generation: {
        mode: params.mode,
        generated_at: nowIso,
        prompt_version: VOCABULARY_GOLD_CONTENT_PROMPT_VERSION,
        model: AI_MODELS.liveReasoning,
        validation_issues: params.issues.map((issue) => ({
          field: issue.field,
          code: issue.code,
          severity: issue.severity,
        })),
      },
    },
    sourceQuality: "ai_generated" as const,
    generationVersion: CURRENT_VOCABULARY_CONTENT_GENERATION_VERSION,
    promptVersion: existing?.promptVersion ?? CURRENT_VOCABULARY_CONTENT_PROMPT_VERSION,
    generationModel: AI_MODELS.liveReasoning,
    refreshedAt: nowIso,
    qualityScore: validateVocabularyGoldContent(content).qualityScore,
  };
}

async function processCandidateBatch(params: {
  candidates: BulkCandidate[];
  mode: VocabularyGoldContentBulkMode;
  dryRun: boolean;
}) {
  const results: VocabularyGoldContentBulkItemResult[] = [];
  const seedsToSave: ReturnType<typeof seedFromContent>[] = [];
  const candidatesToGenerate = params.candidates.filter((candidate) => {
    if (params.mode === "full_regenerate") {
      return true;
    }

    if (!candidate.existingEntry) {
      return true;
    }

    if (shouldSkipExistingContent(candidate)) {
      results.push({
        word: candidate.word,
        canonicalLemma: candidate.canonicalLemma,
        status: "skipped",
        dryRun: params.dryRun,
        saved: false,
        issues: [],
        repairFields: [],
      });
      return false;
    }

    return true;
  });

  if (candidatesToGenerate.length === 0) {
    return { results, seedsToSave };
  }

  const generated = await generateVocabularyGoldContentBatch({
    actorType: "admin",
    items: candidatesToGenerate.map((candidate) => ({
      word: candidate.word,
      itemType: candidate.itemType,
      targetLanguage: candidate.translationLanguage,
      partOfSpeechHint:
        candidate.hint?.part_of_speech ?? candidate.existingEntry?.partOfSpeech ?? null,
      definitionHint:
        candidate.hint?.definition ??
        candidate.hint?.english_explanation ??
        candidate.existingEntry?.definition ??
        candidate.existingEntry?.englishExplanation ??
        null,
      translationHint:
        candidate.hint?.translation_meaning ??
        candidate.hint?.translated_explanation ??
        candidate.existingEntry?.translationMeaning ??
        candidate.existingEntry?.translatedExplanation ??
        null,
      exampleHint:
        candidate.hint?.example_sentence ??
        candidate.hint?.example_text ??
        candidate.hint?.context_sentence ??
        candidate.existingEntry?.exampleSentence ??
        candidate.existingEntry?.exampleText ??
        null,
    })),
  });

  const repairRequests: Array<{
    candidate: BulkCandidate;
    content: VocabularyGoldContentRecord;
    issues: VocabularyGoldContentValidationIssue[];
    repairFields: ReturnType<typeof getRepairableVocabularyGoldContentFields>;
  }> = [];

  for (const candidate of candidatesToGenerate) {
    const generatedContent =
      generated.get(normalizeKey(candidate.word)) ??
      (candidate.existingEntry ? contentFromEntry(candidate.existingEntry) : contentFromCandidate(candidate));
    const validation = validateVocabularyGoldContent(generatedContent);
    const repairFields = getRepairableVocabularyGoldContentFields(validation.issues);

    if (!validation.isValidForSave && repairFields.length > 0) {
      repairRequests.push({
        candidate,
        content: validation.content,
        issues: validation.issues,
        repairFields,
      });
      continue;
    }

    if (!validation.isValidForSave) {
      results.push({
        word: candidate.word,
        canonicalLemma: candidate.canonicalLemma,
        status: "failed",
        dryRun: params.dryRun,
        saved: false,
        issues: validation.issues,
        repairFields,
        error: "Validation failed and no repairable fields were available.",
      });
      continue;
    }

    const seed = seedFromContent({
      candidate,
      content: validation.content,
      issues: validation.issues,
      mode: params.mode,
    });
    seedsToSave.push(seed);
    results.push({
      word: candidate.word,
      canonicalLemma: candidate.canonicalLemma,
      status: candidate.existingEntry ? "fixed" : "generated",
      dryRun: params.dryRun,
      saved: false,
      issues: validation.issues,
      repairFields,
    });
  }

  if (repairRequests.length > 0) {
    const repairs = await repairVocabularyGoldContentBatch({
      actorType: "admin",
      items: repairRequests.map((request) => ({
        current: request.content,
        targetLanguage: request.candidate.translationLanguage,
        failingFields: request.repairFields,
        issues: request.issues.map((issue) => `${issue.field}:${issue.code}`),
      })),
    });

    for (const request of repairRequests) {
      const patch = repairs.get(normalizeKey(request.candidate.word)) ?? {};
      const repairedContent = mergeVocabularyGoldContentRepair(request.content, patch);
      const validation = validateVocabularyGoldContent(repairedContent);

      if (!validation.isValidForSave) {
        results.push({
          word: request.candidate.word,
          canonicalLemma: request.candidate.canonicalLemma,
          status: "failed",
          dryRun: params.dryRun,
          saved: false,
          issues: validation.issues,
          repairFields: request.repairFields,
          error: "Validation failed after targeted repair.",
        });
        continue;
      }

      const seed = seedFromContent({
        candidate: request.candidate,
        content: validation.content,
        issues: validation.issues,
        mode: params.mode,
      });
      seedsToSave.push(seed);
      results.push({
        word: request.candidate.word,
        canonicalLemma: request.candidate.canonicalLemma,
        status: "fixed",
        dryRun: params.dryRun,
        saved: false,
        issues: validation.issues,
        repairFields: request.repairFields,
      });
    }
  }

  return { results, seedsToSave };
}

export async function runVocabularyGoldContentBulkGeneration(
  params: VocabularyGoldContentBulkParams
): Promise<VocabularyGoldContentBulkResult> {
  const dryRun = params.dryRun !== false;
  const mode: VocabularyGoldContentBulkMode =
    params.mode === "full_regenerate" ? "full_regenerate" : "repair_missing";
  const batchSize =
    typeof params.batchSize === "number" && Number.isFinite(params.batchSize)
      ? Math.max(1, Math.min(100, Math.floor(params.batchSize)))
      : 50;
  const candidates = await buildCandidates(params);
  const batches: VocabularyGoldContentBulkResult["batches"] = [];
  const allResults: VocabularyGoldContentBulkItemResult[] = [];

  for (const [batchIndex, candidateBatch] of chunk(candidates, batchSize).entries()) {
    const batchResult = await processCandidateBatch({
      candidates: candidateBatch,
      mode,
      dryRun,
    });

    if (!dryRun && batchResult.seedsToSave.length > 0) {
      await upsertVocabularyDictionaryCacheEntries(batchResult.seedsToSave);
      for (const result of batchResult.results) {
        if (result.status !== "failed" && result.status !== "skipped") {
          result.saved = true;
        }
      }
    }

    const generated = batchResult.results.filter((item) => item.status === "generated").length;
    const fixed = batchResult.results.filter((item) => item.status === "fixed").length;
    const failed = batchResult.results.filter((item) => item.status === "failed").length;
    const skipped = batchResult.results.filter((item) => item.status === "skipped").length;
    const saved = batchResult.results.filter((item) => item.saved).length;

    batches.push({
      index: batchIndex + 1,
      candidateCount: candidateBatch.length,
      generated,
      fixed,
      failed,
      skipped,
      saved,
    });
    allResults.push(...batchResult.results);

    console.info("vocab gold content batch", {
      batch: batchIndex + 1,
      candidateCount: candidateBatch.length,
      generated,
      fixed,
      failed,
      skipped,
      saved,
      dryRun,
    });
  }

  return {
    dryRun,
    mode,
    batchSize,
    totalCandidates: candidates.length,
    generated: allResults.filter((item) => item.status === "generated").length,
    fixed: allResults.filter((item) => item.status === "fixed").length,
    failed: allResults.filter((item) => item.status === "failed").length,
    skipped: allResults.filter((item) => item.status === "skipped").length,
    saved: allResults.filter((item) => item.saved).length,
    batches,
    items: allResults,
  };
}
