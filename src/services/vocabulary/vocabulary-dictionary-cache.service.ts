import { createClient } from "@/lib/supabase/server";
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";
import type { VocabularyDrillAnswerSetMap } from "@/types/vocabulary-answer-sets";

export const DEFAULT_VOCABULARY_SOURCE_LANGUAGE = "en";
export const DEFAULT_VOCABULARY_CONTENT_PROFILE = "sat_core_v1";
export const CURRENT_VOCABULARY_CONTENT_GENERATION_VERSION = 2;
export const CURRENT_VOCABULARY_CONTENT_PROMPT_VERSION = "sat_core_v2";

export type VocabularyDictionaryCacheEntry = {
  id: string;
  normalizedItemText: string;
  itemText: string;
  itemType: "word" | "phrase";
  canonicalLemma: string;
  sourceLanguage: string;
  translationLanguage: string;
  contentProfile: string;
  englishExplanation: string;
  translatedExplanation: string;
  exampleText: string | null;
  distractors: string[];
  drillAnswerSets: VocabularyDrillAnswerSetMap;
  alternateDefinitions: string[];
  synonymCandidates: string[];
  antonymCandidates: string[];
  exampleSentences: string[];
  collocations: string[];
  confusionPairs: string[];
  drillIngredients: Record<string, unknown>;
  sourceQuality: "ai_generated" | "human_reviewed";
  usageCount: number;
  generationVersion: number;
  promptVersion: string;
  generationModel: string | null;
  refreshedAt: string;
  qualityScore: number | null;
};

export type VocabularyDictionaryCacheSeed = {
  itemText: string;
  itemType: "word" | "phrase";
  canonicalLemma?: string | null;
  sourceLanguage?: string | null;
  translationLanguage: string;
  contentProfile?: string | null;
  englishExplanation: string;
  translatedExplanation: string;
  exampleText?: string | null;
  distractors?: string[] | null;
  drillAnswerSets?: VocabularyDrillAnswerSetMap | null;
  alternateDefinitions?: string[] | null;
  synonymCandidates?: string[] | null;
  antonymCandidates?: string[] | null;
  exampleSentences?: string[] | null;
  collocations?: string[] | null;
  confusionPairs?: string[] | null;
  drillIngredients?: Record<string, unknown> | null;
  sourceQuality?: "ai_generated" | "human_reviewed";
  generationVersion?: number | null;
  promptVersion?: string | null;
  generationModel?: string | null;
  refreshedAt?: string | null;
  qualityScore?: number | null;
};

function normalizeDictionaryItemText(itemText: string) {
  return itemText
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function normalizeCacheItemType(itemType: string | null | undefined) {
  return itemType === "phrase" ? "phrase" : "word";
}

function normalizeCacheTranslationLanguage(language: string | null | undefined) {
  return language?.trim() || "ru";
}

function normalizeCacheSourceLanguage(language: string | null | undefined) {
  return language?.trim() || DEFAULT_VOCABULARY_SOURCE_LANGUAGE;
}

function normalizeCacheContentProfile(profile: string | null | undefined) {
  return profile?.trim() || DEFAULT_VOCABULARY_CONTENT_PROFILE;
}

function normalizeCacheCanonicalLemma(params: {
  itemText: string;
  itemType: string | null | undefined;
  canonicalLemma?: string | null;
}) {
  const explicit = params.canonicalLemma?.trim().toLowerCase();
  if (explicit) {
    return explicit;
  }

  const resolved = resolveVocabularyLemma({
    itemText: params.itemText,
    itemType: params.itemType,
  }).canonicalLemma;

  return resolved || normalizeDictionaryItemText(params.itemText);
}

function sanitizeTextArray(values: unknown, limit?: number) {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Map<string, string>();

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim().replace(/\s+/g, " ");
    const compareKey = normalized.toLowerCase();

    if (!normalized || deduped.has(compareKey)) {
      continue;
    }

    deduped.set(compareKey, normalized);
  }

  const nextValues = Array.from(deduped.values());
  return typeof limit === "number" ? nextValues.slice(0, limit) : nextValues;
}

function sanitizeDrillIngredients(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function buildVocabularyDictionaryCacheKey(params: {
  itemText: string;
  itemType: string | null | undefined;
  canonicalLemma?: string | null;
  translationLanguage: string | null | undefined;
  sourceLanguage?: string | null | undefined;
  contentProfile?: string | null | undefined;
}) {
  const canonicalLemma = normalizeCacheCanonicalLemma(params);
  const itemType = normalizeCacheItemType(params.itemType);
  const translationLanguage = normalizeCacheTranslationLanguage(params.translationLanguage);
  const sourceLanguage = normalizeCacheSourceLanguage(params.sourceLanguage);
  const contentProfile = normalizeCacheContentProfile(params.contentProfile);

  return `${canonicalLemma}::${itemType}::${sourceLanguage}::${translationLanguage}::${contentProfile}`;
}

function mapDictionaryRow(row: any): VocabularyDictionaryCacheEntry {
  return {
    id: row.id as string,
    normalizedItemText: row.normalized_item_text as string,
    itemText: row.item_text as string,
    itemType: row.item_type === "phrase" ? "phrase" : "word",
    canonicalLemma:
      (row.canonical_lemma as string | null)?.trim().toLowerCase() ||
      normalizeDictionaryItemText(row.item_text as string),
    sourceLanguage: normalizeCacheSourceLanguage(row.source_language as string | null),
    translationLanguage: normalizeCacheTranslationLanguage(
      row.translation_language as string | null
    ),
    contentProfile: normalizeCacheContentProfile(row.content_profile as string | null),
    englishExplanation: row.english_explanation as string,
    translatedExplanation: row.translated_explanation as string,
    exampleText: (row.example_text as string | null) ?? null,
    distractors: sanitizeTextArray(row.distractors),
    drillAnswerSets:
      row.drill_answer_sets &&
      typeof row.drill_answer_sets === "object" &&
      !Array.isArray(row.drill_answer_sets)
        ? (row.drill_answer_sets as VocabularyDrillAnswerSetMap)
        : ({} as VocabularyDrillAnswerSetMap),
    alternateDefinitions: sanitizeTextArray(row.alternate_definitions, 4),
    synonymCandidates: sanitizeTextArray(row.synonym_candidates, 6),
    antonymCandidates: sanitizeTextArray(row.antonym_candidates, 4),
    exampleSentences: sanitizeTextArray(row.example_sentences, 6),
    collocations: sanitizeTextArray(row.collocations, 6),
    confusionPairs: sanitizeTextArray(row.confusion_pairs, 6),
    drillIngredients: sanitizeDrillIngredients(row.drill_ingredients),
    sourceQuality:
      row.source_quality === "human_reviewed" ? "human_reviewed" : "ai_generated",
    usageCount: Number(row.usage_count ?? 0),
    generationVersion: Number(row.generation_version ?? 1),
    promptVersion:
      (typeof row.prompt_version === "string" && row.prompt_version.trim()) || "legacy_v1",
    generationModel:
      typeof row.generation_model === "string" && row.generation_model.trim()
        ? row.generation_model
        : null,
    refreshedAt:
      (typeof row.refreshed_at === "string" && row.refreshed_at) ||
      (typeof row.updated_at === "string" && row.updated_at) ||
      (typeof row.created_at === "string" && row.created_at) ||
      new Date(0).toISOString(),
    qualityScore:
      typeof row.quality_score === "number" && Number.isFinite(row.quality_score)
        ? row.quality_score
        : typeof row.quality_score === "string" &&
            Number.isFinite(Number(row.quality_score))
          ? Number(row.quality_score)
          : null,
  };
}

export async function listVocabularyDictionaryCacheEntries(params: {
  items: Array<{
    itemText: string;
    itemType: string | null | undefined;
    canonicalLemma?: string | null;
  }>;
  translationLanguage: string;
  sourceLanguage?: string | null;
  contentProfile?: string | null;
}) {
  const supabase = await createClient();
  const normalizedItems = params.items
    .map((item) => ({
      normalizedItemText: normalizeDictionaryItemText(item.itemText),
      canonicalLemma: normalizeCacheCanonicalLemma(item),
      itemType: normalizeCacheItemType(item.itemType),
    }))
    .filter((item) => item.normalizedItemText || item.canonicalLemma);

  if (normalizedItems.length === 0) {
    return new Map<string, VocabularyDictionaryCacheEntry>();
  }

  const translationLanguage = normalizeCacheTranslationLanguage(params.translationLanguage);
  const sourceLanguage = normalizeCacheSourceLanguage(params.sourceLanguage);
  const contentProfile = normalizeCacheContentProfile(params.contentProfile);
  const normalizedTextList = Array.from(
    new Set(normalizedItems.map((item) => item.normalizedItemText).filter(Boolean))
  );
  const canonicalLemmaList = Array.from(
    new Set(normalizedItems.map((item) => item.canonicalLemma).filter(Boolean))
  );

  const queries: Array<PromiseLike<{ data: any[] | null; error: any }>> = [];

  if (canonicalLemmaList.length > 0) {
    queries.push(
      supabase
        .from("vocabulary_dictionary_cache")
        .select("*")
        .eq("translation_language", translationLanguage)
        .eq("source_language", sourceLanguage)
        .eq("content_profile", contentProfile)
        .in("canonical_lemma", canonicalLemmaList)
    );
  }

  if (normalizedTextList.length > 0) {
    queries.push(
      supabase
        .from("vocabulary_dictionary_cache")
        .select("*")
        .eq("translation_language", translationLanguage)
        .eq("source_language", sourceLanguage)
        .eq("content_profile", contentProfile)
        .in("normalized_item_text", normalizedTextList)
    );
  }

  const results = await Promise.all(queries);
  const rowsById = new Map<string, any>();

  for (const result of results) {
    if (result.error) {
      throw result.error;
    }

    for (const row of result.data ?? []) {
      if (row?.id) {
        rowsById.set(row.id, row);
      }
    }
  }

  const entryMap = new Map<string, VocabularyDictionaryCacheEntry>();

  for (const row of rowsById.values()) {
    const entry = mapDictionaryRow(row);
    entryMap.set(
      buildVocabularyDictionaryCacheKey({
        itemText: entry.itemText,
        itemType: entry.itemType,
        canonicalLemma: entry.canonicalLemma,
        translationLanguage: entry.translationLanguage,
        sourceLanguage: entry.sourceLanguage,
        contentProfile: entry.contentProfile,
      }),
      entry
    );
  }

  return entryMap;
}

export async function upsertVocabularyDictionaryCacheEntries(
  seeds: VocabularyDictionaryCacheSeed[]
) {
  const supabase = await createClient();
  const rows = seeds
    .map((seed) => {
      const normalizedItemText = normalizeDictionaryItemText(seed.itemText);
      const canonicalLemma = normalizeCacheCanonicalLemma(seed);
      const englishExplanation = seed.englishExplanation.trim();
      const translatedExplanation = seed.translatedExplanation.trim();

      if (!normalizedItemText || !canonicalLemma || !englishExplanation || !translatedExplanation) {
        return null;
      }

      return {
        normalized_item_text: normalizedItemText,
        item_text: seed.itemText.trim(),
        item_type: normalizeCacheItemType(seed.itemType),
        canonical_lemma: canonicalLemma,
        source_language: normalizeCacheSourceLanguage(seed.sourceLanguage),
        translation_language: normalizeCacheTranslationLanguage(seed.translationLanguage),
        content_profile: normalizeCacheContentProfile(seed.contentProfile),
        english_explanation: englishExplanation,
        translated_explanation: translatedExplanation,
        example_text: seed.exampleText?.trim() || null,
        distractors: sanitizeTextArray(seed.distractors, 8),
        drill_answer_sets:
          seed.drillAnswerSets &&
          typeof seed.drillAnswerSets === "object" &&
          !Array.isArray(seed.drillAnswerSets)
            ? seed.drillAnswerSets
            : {},
        alternate_definitions: sanitizeTextArray(seed.alternateDefinitions, 4),
        synonym_candidates: sanitizeTextArray(seed.synonymCandidates, 6),
        antonym_candidates: sanitizeTextArray(seed.antonymCandidates, 4),
        example_sentences: sanitizeTextArray(seed.exampleSentences, 6),
        collocations: sanitizeTextArray(seed.collocations, 6),
        confusion_pairs: sanitizeTextArray(seed.confusionPairs, 6),
        drill_ingredients: sanitizeDrillIngredients(seed.drillIngredients),
        source_quality: seed.sourceQuality ?? "ai_generated",
        generation_version:
          typeof seed.generationVersion === "number" && Number.isFinite(seed.generationVersion)
            ? seed.generationVersion
            : CURRENT_VOCABULARY_CONTENT_GENERATION_VERSION,
        prompt_version:
          seed.promptVersion?.trim() || CURRENT_VOCABULARY_CONTENT_PROMPT_VERSION,
        generation_model: seed.generationModel?.trim() || null,
        refreshed_at: seed.refreshedAt ?? new Date().toISOString(),
        quality_score:
          typeof seed.qualityScore === "number" && Number.isFinite(seed.qualityScore)
            ? seed.qualityScore
            : null,
        last_used_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("vocabulary_dictionary_cache").upsert(rows, {
    onConflict:
      "canonical_lemma,item_type,source_language,translation_language,content_profile",
  });

  if (error) {
    throw error;
  }
}

export async function touchVocabularyDictionaryCacheEntries(
  entries: VocabularyDictionaryCacheEntry[]
) {
  if (entries.length === 0) {
    return;
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  await Promise.all(
    entries.map(async (entry) => {
      const { error } = await supabase
        .from("vocabulary_dictionary_cache")
        .update({
          usage_count: entry.usageCount + 1,
          last_used_at: nowIso,
        })
        .eq("id", entry.id);

      if (error) {
        throw error;
      }
    })
  );
}
