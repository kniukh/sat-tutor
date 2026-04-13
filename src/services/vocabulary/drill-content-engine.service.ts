import { AI_MODELS } from "@/services/ai/ai-models";
import { generateVocabularyCards } from "@/services/ai/generate-vocabulary-cards";
import {
  buildPreparedVocabularyDrillAnswerSetCacheKey,
  hasReadyVocabularyDrillAnswerSets,
  parseVocabularyDrillAnswerSets,
  prepareVocabularyDrillAnswerSetsBatch,
} from "@/services/vocabulary/drill-answer-sets.service";
import {
  prepareVocabularyDistractorsBatch,
} from "@/services/vocabulary/distractor-quality.service";
import {
  buildVocabularyDictionaryCacheKey,
  CURRENT_VOCABULARY_CONTENT_GENERATION_VERSION,
  CURRENT_VOCABULARY_CONTENT_PROMPT_VERSION,
  DEFAULT_VOCABULARY_CONTENT_PROFILE,
  DEFAULT_VOCABULARY_SOURCE_LANGUAGE,
  listVocabularyDictionaryCacheEntries,
  type VocabularyDictionaryCacheEntry,
  type VocabularyDictionaryCacheSeed,
  touchVocabularyDictionaryCacheEntries,
  upsertVocabularyDictionaryCacheEntries,
} from "@/services/vocabulary/vocabulary-dictionary-cache.service";
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";
import type { VocabularyDrillAnswerSetMap } from "@/types/vocabulary-answer-sets";

export type ReusableVocabularyContentCandidate = {
  itemText: string;
  itemType: "word" | "phrase";
  canonicalLemma?: string | null;
  fallbackEnglishExplanation?: string | null;
  fallbackTranslatedExplanation?: string | null;
  fallbackExampleText?: string | null;
  existingDistractors?: string[] | null;
  existingAnswerSets?: VocabularyDrillAnswerSetMap | null;
};

type EnsureReusableVocabularyContentParams = {
  items: ReusableVocabularyContentCandidate[];
  translationLanguage: string;
  requestedByStudentId?: string | null;
  includeDrillAssets?: boolean;
  sourceLanguage?: string | null;
  contentProfile?: string | null;
};

function normalizeKey(text: string) {
  return text.trim().toLowerCase();
}

function uniqueTextValues(values: Array<string | null | undefined>, limit?: number) {
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

  const items = Array.from(deduped.values());
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function resolveCandidateCanonicalLemma(candidate: ReusableVocabularyContentCandidate) {
  return (
    candidate.canonicalLemma?.trim().toLowerCase() ||
    resolveVocabularyLemma({
      itemText: candidate.itemText,
      itemType: candidate.itemType,
    }).canonicalLemma
  );
}

function buildReusableCandidateKey(params: {
  itemText: string;
  itemType: "word" | "phrase";
  canonicalLemma?: string | null;
  translationLanguage: string;
  sourceLanguage?: string | null;
  contentProfile?: string | null;
}) {
  return buildVocabularyDictionaryCacheKey({
    itemText: params.itemText,
    itemType: params.itemType,
    canonicalLemma: params.canonicalLemma,
    translationLanguage: params.translationLanguage,
    sourceLanguage: params.sourceLanguage ?? DEFAULT_VOCABULARY_SOURCE_LANGUAGE,
    contentProfile: params.contentProfile ?? DEFAULT_VOCABULARY_CONTENT_PROFILE,
  });
}

function dedupeReusableCandidates(
  candidates: ReusableVocabularyContentCandidate[],
  params: { translationLanguage: string; sourceLanguage: string; contentProfile: string }
) {
  const deduped = new Map<string, ReusableVocabularyContentCandidate>();

  for (const candidate of candidates) {
    const key = buildReusableCandidateKey({
      itemText: candidate.itemText,
      itemType: candidate.itemType,
      canonicalLemma: resolveCandidateCanonicalLemma(candidate),
      translationLanguage: params.translationLanguage,
      sourceLanguage: params.sourceLanguage,
      contentProfile: params.contentProfile,
    });

    if (!deduped.has(key)) {
      deduped.set(key, {
        ...candidate,
        canonicalLemma: resolveCandidateCanonicalLemma(candidate),
      });
      continue;
    }

    const existing = deduped.get(key)!;
    deduped.set(key, {
      ...existing,
      fallbackEnglishExplanation:
        existing.fallbackEnglishExplanation ?? candidate.fallbackEnglishExplanation ?? null,
      fallbackTranslatedExplanation:
        existing.fallbackTranslatedExplanation ?? candidate.fallbackTranslatedExplanation ?? null,
      fallbackExampleText:
        existing.fallbackExampleText ?? candidate.fallbackExampleText ?? null,
      existingDistractors:
        existing.existingDistractors?.length
          ? existing.existingDistractors
          : candidate.existingDistractors ?? null,
      existingAnswerSets:
        existing.existingAnswerSets && Object.keys(existing.existingAnswerSets).length > 0
          ? existing.existingAnswerSets
          : candidate.existingAnswerSets ?? null,
    });
  }

  return Array.from(deduped.values());
}

function isReusableVocabularyContentReady(
  entry: VocabularyDictionaryCacheEntry,
  params: { requireDrillAssets: boolean }
) {
  const hasBase =
    Boolean(entry.englishExplanation.trim()) &&
    Boolean(entry.translatedExplanation.trim()) &&
    entry.generationVersion >= CURRENT_VOCABULARY_CONTENT_GENERATION_VERSION &&
    entry.promptVersion === CURRENT_VOCABULARY_CONTENT_PROMPT_VERSION;

  if (!hasBase) {
    return false;
  }

  if (!params.requireDrillAssets) {
    return true;
  }

  return (
    entry.distractors.length >= 3 &&
    hasReadyVocabularyDrillAnswerSets(entry.drillAnswerSets)
  );
}

function buildReusableDrillIngredients(params: {
  itemText: string;
  exampleText: string | null;
  answerSets: VocabularyDrillAnswerSetMap;
}) {
  const meta = params.answerSets.__meta__;
  const practiceSentence =
    meta?.practice_example_sentence?.trim() ||
    params.exampleText?.trim() ||
    null;
  const supportedTypes = [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "spelling_from_audio",
    "context_meaning",
    "synonym",
  ];

  if (practiceSentence) {
    supportedTypes.push("fill_blank", "sentence_builder");
  }

  if ((meta?.collocation_candidates?.length ?? 0) > 0 || params.answerSets.collocation) {
    supportedTypes.push("collocation");
  }

  if ((meta?.confusion_pairs?.length ?? 0) > 0 && practiceSentence) {
    supportedTypes.push("error_detection");
  }

  return {
    supported_types: Array.from(new Set(supportedTypes)),
    primary_practice_sentence: practiceSentence,
    alternate_definitions: meta?.alternate_definitions ?? [],
    synonym_candidates: meta?.synonym_candidates ?? [],
    antonym_candidates: meta?.antonym_candidates ?? [],
    collocation_candidates: meta?.collocation_candidates ?? [],
    confusion_pairs: meta?.confusion_pairs ?? [],
    translation_variants: {
      english_to_native: Boolean(params.answerSets.translation_english_to_native),
      native_to_english: Boolean(params.answerSets.translation_native_to_english),
    },
    context_variant: Boolean(params.answerSets.context_meaning),
    collocation_variant: Boolean(params.answerSets.collocation),
    target_item_text: params.itemText,
  };
}

function buildReusableContentQualityScore(params: {
  englishExplanation: string;
  translatedExplanation: string;
  distractors: string[];
  answerSets: VocabularyDrillAnswerSetMap;
  exampleText: string | null;
}) {
  let score = 0;

  if (params.englishExplanation.trim()) {
    score += 0.2;
  }

  if (params.translatedExplanation.trim()) {
    score += 0.2;
  }

  if (params.distractors.length >= 3) {
    score += 0.2;
  }

  if (hasReadyVocabularyDrillAnswerSets(params.answerSets)) {
    score += 0.25;
  }

  if (
    params.exampleText?.trim() ||
    params.answerSets.__meta__?.practice_example_sentence?.trim()
  ) {
    score += 0.1;
  }

  if (
    (params.answerSets.__meta__?.alternate_definitions?.length ?? 0) > 0 ||
    (params.answerSets.__meta__?.synonym_candidates?.length ?? 0) > 0 ||
    (params.answerSets.__meta__?.collocation_candidates?.length ?? 0) > 0
  ) {
    score += 0.05;
  }

  return Math.min(1, Number(score.toFixed(2)));
}

function buildGlobalSeedFromPreparedContent(params: {
  candidate: ReusableVocabularyContentCandidate;
  translationLanguage: string;
  sourceLanguage: string;
  contentProfile: string;
  existingEntry: VocabularyDictionaryCacheEntry | null;
  englishExplanation: string;
  translatedExplanation: string;
  exampleText: string | null;
  distractors: string[];
  answerSets: VocabularyDrillAnswerSetMap;
  refreshedAt: string;
}) {
  const meta = params.answerSets.__meta__;
  const alternateDefinitions = uniqueTextValues(
    [
      ...(meta?.alternate_definitions ?? []),
      meta?.refined_definition ?? null,
      ...(params.existingEntry?.alternateDefinitions ?? []),
    ],
    4
  ).filter((definition) => normalizeKey(definition) !== normalizeKey(params.englishExplanation));
  const exampleSentences = uniqueTextValues(
    [
      meta?.practice_example_sentence ?? null,
      params.exampleText,
      ...(params.existingEntry?.exampleSentences ?? []),
    ],
    6
  );
  const synonymCandidates = uniqueTextValues(
    [...(meta?.synonym_candidates ?? []), ...(params.existingEntry?.synonymCandidates ?? [])],
    6
  );
  const antonymCandidates = uniqueTextValues(
    [...(meta?.antonym_candidates ?? []), ...(params.existingEntry?.antonymCandidates ?? [])],
    4
  );
  const collocations = uniqueTextValues(
    [...(meta?.collocation_candidates ?? []), ...(params.existingEntry?.collocations ?? [])],
    6
  );
  const confusionPairs = uniqueTextValues(
    [...(meta?.confusion_pairs ?? []), ...(params.existingEntry?.confusionPairs ?? [])],
    6
  );

  return {
    itemText: params.candidate.itemText,
    itemType: params.candidate.itemType,
    canonicalLemma: params.candidate.canonicalLemma,
    translationLanguage: params.translationLanguage,
    sourceLanguage: params.sourceLanguage,
    contentProfile: params.contentProfile,
    englishExplanation: params.englishExplanation,
    translatedExplanation: params.translatedExplanation,
    exampleText: params.exampleText,
    distractors: params.distractors,
    drillAnswerSets: params.answerSets,
    alternateDefinitions,
    synonymCandidates,
    antonymCandidates,
    exampleSentences,
    collocations,
    confusionPairs,
    drillIngredients: buildReusableDrillIngredients({
      itemText: params.candidate.itemText,
      exampleText: params.exampleText,
      answerSets: params.answerSets,
    }),
    sourceQuality: params.existingEntry?.sourceQuality ?? "ai_generated",
    generationVersion: CURRENT_VOCABULARY_CONTENT_GENERATION_VERSION,
    promptVersion: CURRENT_VOCABULARY_CONTENT_PROMPT_VERSION,
    generationModel: AI_MODELS.liveReasoning,
    refreshedAt: params.refreshedAt,
    qualityScore: buildReusableContentQualityScore({
      englishExplanation: params.englishExplanation,
      translatedExplanation: params.translatedExplanation,
      distractors: params.distractors,
      answerSets: params.answerSets,
      exampleText: params.exampleText,
    }),
  } satisfies VocabularyDictionaryCacheSeed;
}

export async function ensureReusableVocabularyContent(
  params: EnsureReusableVocabularyContentParams
) {
  const translationLanguage = params.translationLanguage?.trim() || "ru";
  const sourceLanguage = params.sourceLanguage?.trim() || DEFAULT_VOCABULARY_SOURCE_LANGUAGE;
  const contentProfile = params.contentProfile?.trim() || DEFAULT_VOCABULARY_CONTENT_PROFILE;
  const includeDrillAssets = params.includeDrillAssets !== false;
  const candidates = dedupeReusableCandidates(params.items, {
    translationLanguage,
    sourceLanguage,
    contentProfile,
  });
  const existingMap = await listVocabularyDictionaryCacheEntries({
    items: candidates.map((candidate) => ({
      itemText: candidate.itemText,
      itemType: candidate.itemType,
      canonicalLemma: candidate.canonicalLemma,
    })),
    translationLanguage,
    sourceLanguage,
    contentProfile,
  });
  const usedEntries: VocabularyDictionaryCacheEntry[] = [];
  const readyEntryMap = new Map<string, VocabularyDictionaryCacheEntry>();
  const pendingCandidates: Array<{
    candidate: ReusableVocabularyContentCandidate;
    existingEntry: VocabularyDictionaryCacheEntry | null;
    cacheKey: string;
  }> = [];

  for (const candidate of candidates) {
    const cacheKey = buildReusableCandidateKey({
      itemText: candidate.itemText,
      itemType: candidate.itemType,
      canonicalLemma: candidate.canonicalLemma,
      translationLanguage,
      sourceLanguage,
      contentProfile,
    });
    const existingEntry = existingMap.get(cacheKey) ?? null;

    if (
      existingEntry &&
      isReusableVocabularyContentReady(existingEntry, {
        requireDrillAssets: includeDrillAssets,
      })
    ) {
      readyEntryMap.set(cacheKey, existingEntry);
      usedEntries.push(existingEntry);
      continue;
    }

    pendingCandidates.push({
      candidate,
      existingEntry,
      cacheKey,
    });
  }

  if (pendingCandidates.length === 0) {
    if (usedEntries.length > 0) {
      await touchVocabularyDictionaryCacheEntries(usedEntries);
    }

    return {
      entryMap: readyEntryMap,
      usedEntries,
      generatedCount: 0,
    };
  }

  let generatedCards: Array<{
    item_text: string;
    english_explanation: string;
    translated_explanation: string;
    example_text: string;
  }> = [];

  try {
    generatedCards = await generateVocabularyCards({
      items: pendingCandidates.map(({ candidate }) => ({
        item_text: candidate.itemText,
        item_type: candidate.itemType,
        context_text: null,
      })),
      nativeLanguage: translationLanguage,
      studentId: params.requestedByStudentId ?? null,
    });
  } catch (error) {
    console.error("ensureReusableVocabularyContent generateVocabularyCards", error);
  }

  const generatedCardMap = new Map(
    generatedCards.map((card) => [normalizeKey(card.item_text), card])
  );
  const meaningPool = uniqueTextValues([
    ...generatedCards.map((card) => card.english_explanation),
    ...pendingCandidates.map(({ candidate, existingEntry }) =>
      candidate.fallbackEnglishExplanation ??
      existingEntry?.englishExplanation ??
      null
    ),
  ]);
  const translationPool = uniqueTextValues([
    ...generatedCards.map((card) => card.translated_explanation),
    ...pendingCandidates.map(({ candidate, existingEntry }) =>
      candidate.fallbackTranslatedExplanation ??
      existingEntry?.translatedExplanation ??
      null
    ),
  ]);
  const lexicalPool = uniqueTextValues(
    pendingCandidates.map(({ candidate }) => candidate.itemText)
  );

  let distractorBatchMap = new Map<string, string[]>();
  let answerSetBatchMap = new Map<string, VocabularyDrillAnswerSetMap>();

  if (includeDrillAssets) {
    const distractorBatchInputs = pendingCandidates.map(({ candidate, existingEntry }) => {
      const generatedCard = generatedCardMap.get(normalizeKey(candidate.itemText));
      const englishExplanation =
        generatedCard?.english_explanation ??
        existingEntry?.englishExplanation ??
        candidate.fallbackEnglishExplanation?.trim() ??
        `Meaning of "${candidate.itemText}"`;
      const exampleText =
        generatedCard?.example_text ??
        existingEntry?.exampleText ??
        candidate.fallbackExampleText?.trim() ??
        `A sentence with "${candidate.itemText}".`;

      return {
        itemText: candidate.itemText,
        itemType: candidate.itemType,
        correctAnswer: englishExplanation,
        studentId: params.requestedByStudentId ?? null,
        contextSentence: null,
        exampleText,
        existingDistractors: existingEntry?.distractors ?? candidate.existingDistractors ?? [],
        fallbackPool: meaningPool.filter(
          (value) => normalizeKey(value) !== normalizeKey(englishExplanation)
        ),
      };
    });

    distractorBatchMap = await prepareVocabularyDistractorsBatch(distractorBatchInputs);

    const answerSetBatchInputs = pendingCandidates.map(({ candidate, existingEntry }) => {
      const generatedCard = generatedCardMap.get(normalizeKey(candidate.itemText));
      const englishExplanation =
        generatedCard?.english_explanation ??
        existingEntry?.englishExplanation ??
        candidate.fallbackEnglishExplanation?.trim() ??
        `Meaning of "${candidate.itemText}"`;
      const translatedExplanation =
        generatedCard?.translated_explanation ??
        existingEntry?.translatedExplanation ??
        candidate.fallbackTranslatedExplanation?.trim() ??
        candidate.itemText;
      const exampleText =
        generatedCard?.example_text ??
        existingEntry?.exampleText ??
        candidate.fallbackExampleText?.trim() ??
        `A sentence with "${candidate.itemText}".`;

      return {
        itemText: candidate.itemText,
        itemType: candidate.itemType,
        englishExplanation,
        studentId: params.requestedByStudentId ?? null,
        translatedExplanation,
        contextSentence: null,
        exampleText,
        existingAnswerSets:
          existingEntry?.drillAnswerSets ??
          candidate.existingAnswerSets ??
          {},
        meaningFallbackPool: meaningPool.filter(
          (value) => normalizeKey(value) !== normalizeKey(englishExplanation)
        ),
        translationFallbackPool: translationPool.filter(
          (value) => normalizeKey(value) !== normalizeKey(translatedExplanation)
        ),
        lexicalFallbackPool: lexicalPool.filter(
          (value) => normalizeKey(value) !== normalizeKey(candidate.itemText)
        ),
      };
    });

    answerSetBatchMap = await prepareVocabularyDrillAnswerSetsBatch(answerSetBatchInputs);
  }

  const refreshedAt = new Date().toISOString();
  const seeds = pendingCandidates
    .map(({ candidate, existingEntry }) => {
      const generatedCard = generatedCardMap.get(normalizeKey(candidate.itemText));
      const englishExplanation =
        generatedCard?.english_explanation ??
        existingEntry?.englishExplanation ??
        candidate.fallbackEnglishExplanation?.trim() ??
        "";
      const translatedExplanation =
        generatedCard?.translated_explanation ??
        existingEntry?.translatedExplanation ??
        candidate.fallbackTranslatedExplanation?.trim() ??
        "";
      const exampleText =
        generatedCard?.example_text ??
        existingEntry?.exampleText ??
        candidate.fallbackExampleText?.trim() ??
        null;
      const distractors = includeDrillAssets
        ? distractorBatchMap.get(
            `${normalizeKey(candidate.itemText)}::${normalizeKey(englishExplanation)}`
          ) ??
          existingEntry?.distractors ??
          candidate.existingDistractors ??
          []
        : existingEntry?.distractors ?? candidate.existingDistractors ?? [];
      const answerSets = includeDrillAssets
        ? answerSetBatchMap.get(
            buildPreparedVocabularyDrillAnswerSetCacheKey({
              itemText: candidate.itemText,
              englishExplanation,
            })
          ) ??
          existingEntry?.drillAnswerSets ??
          candidate.existingAnswerSets ??
          parseVocabularyDrillAnswerSets({})
        : existingEntry?.drillAnswerSets ??
          candidate.existingAnswerSets ??
          parseVocabularyDrillAnswerSets({});

      if (!englishExplanation || !translatedExplanation) {
        return null;
      }

      return buildGlobalSeedFromPreparedContent({
        candidate,
        translationLanguage,
        sourceLanguage,
        contentProfile,
        existingEntry,
        englishExplanation,
        translatedExplanation,
        exampleText,
        distractors,
        answerSets,
        refreshedAt,
      });
    })
    .filter(Boolean) as VocabularyDictionaryCacheSeed[];

  if (seeds.length > 0) {
    await upsertVocabularyDictionaryCacheEntries(seeds);
  }

  const refreshedMap = await listVocabularyDictionaryCacheEntries({
    items: pendingCandidates.map(({ candidate }) => ({
      itemText: candidate.itemText,
      itemType: candidate.itemType,
      canonicalLemma: candidate.canonicalLemma,
    })),
    translationLanguage,
    sourceLanguage,
    contentProfile,
  });

  for (const [key, entry] of refreshedMap.entries()) {
    readyEntryMap.set(key, entry);
  }

  if (usedEntries.length > 0) {
    await touchVocabularyDictionaryCacheEntries(usedEntries);
  }

  return {
    entryMap: readyEntryMap,
    usedEntries,
    generatedCount: seeds.length,
  };
}

export async function hydrateVocabularyDetailsWithGlobalContent<
  TDetail extends {
    item_text: string;
    item_type?: string | null;
    canonical_lemma?: string | null;
    translation_language?: string | null;
    global_content_id?: string | null;
    english_explanation?: string | null;
    translated_explanation?: string | null;
    example_text?: string | null;
    distractors?: unknown;
    drill_answer_sets?: unknown;
  },
>(params: {
  details: TDetail[];
  translationLanguage: string;
  sourceLanguage?: string | null;
  contentProfile?: string | null;
  touchUsedEntries?: boolean;
}) {
  if (params.details.length === 0) {
    return params.details;
  }

  const sourceLanguage = params.sourceLanguage?.trim() || DEFAULT_VOCABULARY_SOURCE_LANGUAGE;
  const contentProfile = params.contentProfile?.trim() || DEFAULT_VOCABULARY_CONTENT_PROFILE;
  const entryMap = await listVocabularyDictionaryCacheEntries({
    items: params.details.map((detail) => ({
      itemText: detail.item_text,
      itemType: detail.item_type,
      canonicalLemma: detail.canonical_lemma,
    })),
    translationLanguage: params.translationLanguage,
    sourceLanguage,
    contentProfile,
  });
  const usedEntries: VocabularyDictionaryCacheEntry[] = [];

  const hydratedDetails = params.details.map((detail) => {
    const entry =
      entryMap.get(
        buildReusableCandidateKey({
          itemText: detail.item_text,
          itemType: detail.item_type === "phrase" ? "phrase" : "word",
          canonicalLemma: detail.canonical_lemma,
          translationLanguage:
            detail.translation_language ?? params.translationLanguage,
          sourceLanguage,
          contentProfile,
        })
      ) ?? null;

    if (!entry) {
      return detail;
    }

    usedEntries.push(entry);

    return {
      ...detail,
      global_content_id: detail.global_content_id ?? entry.id,
      canonical_lemma: detail.canonical_lemma ?? entry.canonicalLemma,
      english_explanation: entry.englishExplanation || detail.english_explanation,
      translated_explanation:
        entry.translatedExplanation || detail.translated_explanation,
      translation_language:
        detail.translation_language ?? entry.translationLanguage,
      example_text: entry.exampleText || detail.example_text,
      distractors:
        entry.distractors.length > 0 ? entry.distractors : detail.distractors,
      drill_answer_sets:
        hasReadyVocabularyDrillAnswerSets(entry.drillAnswerSets)
          ? entry.drillAnswerSets
          : detail.drill_answer_sets,
    };
  });

  if (params.touchUsedEntries !== false && usedEntries.length > 0) {
    await touchVocabularyDictionaryCacheEntries(usedEntries);
  }

  return hydratedDetails;
}
