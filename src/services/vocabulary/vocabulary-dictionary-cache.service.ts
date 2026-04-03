import { createClient } from "@/lib/supabase/server";
import type { VocabularyDrillAnswerSetMap } from "@/types/vocabulary-answer-sets";

export type VocabularyDictionaryCacheEntry = {
  id: string;
  normalizedItemText: string;
  itemText: string;
  itemType: "word" | "phrase";
  translationLanguage: string;
  englishExplanation: string;
  translatedExplanation: string;
  exampleText: string | null;
  distractors: string[];
  drillAnswerSets: VocabularyDrillAnswerSetMap;
  sourceQuality: "ai_generated" | "human_reviewed";
  usageCount: number;
};

export type VocabularyDictionaryCacheSeed = {
  itemText: string;
  itemType: "word" | "phrase";
  translationLanguage: string;
  englishExplanation: string;
  translatedExplanation: string;
  exampleText?: string | null;
  distractors?: string[] | null;
  drillAnswerSets?: VocabularyDrillAnswerSetMap | null;
  sourceQuality?: "ai_generated" | "human_reviewed";
};

function normalizeDictionaryItemText(itemText: string) {
  return itemText
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function buildVocabularyDictionaryCacheKey(params: {
  itemText: string;
  itemType: string | null | undefined;
  translationLanguage: string | null | undefined;
}) {
  const normalizedItemText = normalizeDictionaryItemText(params.itemText);
  const itemType = params.itemType === "phrase" ? "phrase" : "word";
  const translationLanguage = params.translationLanguage?.trim() || "ru";

  return `${normalizedItemText}::${itemType}::${translationLanguage}`;
}

function mapDictionaryRow(row: any): VocabularyDictionaryCacheEntry {
  return {
    id: row.id as string,
    normalizedItemText: row.normalized_item_text as string,
    itemText: row.item_text as string,
    itemType: row.item_type === "phrase" ? "phrase" : "word",
    translationLanguage: row.translation_language as string,
    englishExplanation: row.english_explanation as string,
    translatedExplanation: row.translated_explanation as string,
    exampleText: (row.example_text as string | null) ?? null,
    distractors: Array.isArray(row.distractors) ? row.distractors : [],
    drillAnswerSets:
      row.drill_answer_sets &&
      typeof row.drill_answer_sets === "object" &&
      !Array.isArray(row.drill_answer_sets)
        ? (row.drill_answer_sets as VocabularyDrillAnswerSetMap)
        : ({} as VocabularyDrillAnswerSetMap),
    sourceQuality:
      row.source_quality === "human_reviewed" ? "human_reviewed" : "ai_generated",
    usageCount: Number(row.usage_count ?? 0),
  };
}

export async function listVocabularyDictionaryCacheEntries(params: {
  items: Array<{ itemText: string; itemType: string | null | undefined }>;
  translationLanguage: string;
}) {
  const supabase = await createClient();
  const normalizedItems = params.items
    .map((item) => ({
      normalizedItemText: normalizeDictionaryItemText(item.itemText),
      itemType: item.itemType === "phrase" ? "phrase" : "word",
    }))
    .filter((item) => item.normalizedItemText);

  if (normalizedItems.length === 0) {
    return new Map<string, VocabularyDictionaryCacheEntry>();
  }

  const normalizedTextList = Array.from(
    new Set(normalizedItems.map((item) => item.normalizedItemText))
  );

  const { data, error } = await supabase
    .from("vocabulary_dictionary_cache")
    .select("*")
    .eq("translation_language", params.translationLanguage)
    .in("normalized_item_text", normalizedTextList);

  if (error) {
    throw error;
  }

  const entryMap = new Map<string, VocabularyDictionaryCacheEntry>();

  for (const row of data ?? []) {
    const entry = mapDictionaryRow(row);
    entryMap.set(
      buildVocabularyDictionaryCacheKey({
        itemText: entry.normalizedItemText,
        itemType: entry.itemType,
        translationLanguage: entry.translationLanguage,
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

      if (
        !normalizedItemText ||
        !seed.englishExplanation.trim() ||
        !seed.translatedExplanation.trim()
      ) {
        return null;
      }

      return {
        normalized_item_text: normalizedItemText,
        item_text: seed.itemText.trim(),
        item_type: seed.itemType,
        translation_language: seed.translationLanguage,
        english_explanation: seed.englishExplanation.trim(),
        translated_explanation: seed.translatedExplanation.trim(),
        example_text: seed.exampleText?.trim() || null,
        distractors: Array.isArray(seed.distractors) ? seed.distractors : [],
        drill_answer_sets:
          seed.drillAnswerSets &&
          typeof seed.drillAnswerSets === "object" &&
          !Array.isArray(seed.drillAnswerSets)
            ? seed.drillAnswerSets
            : {},
        source_quality: seed.sourceQuality ?? "ai_generated",
        last_used_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("vocabulary_dictionary_cache")
    .upsert(rows, {
      onConflict: "normalized_item_text,item_type,translation_language",
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
