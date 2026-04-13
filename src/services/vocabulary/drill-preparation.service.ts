import { createClient } from "@/lib/supabase/server";
import { generateVocabularyAudioBulk } from "@/services/ai/generate-vocabulary-audio-bulk";
import {
  hasReadyVocabularyDrillAnswerSets,
  parseVocabularyDrillAnswerSets,
} from "@/services/vocabulary/drill-answer-sets.service";
import {
  ensureReusableVocabularyContent,
  hydrateVocabularyDetailsWithGlobalContent,
} from "@/services/vocabulary/drill-content-engine.service";
import { buildVocabularyDictionaryCacheKey } from "@/services/vocabulary/vocabulary-dictionary-cache.service";
import {
  aggregateVocabularyCaptureRows,
  type AggregatedVocabularyCapture,
  type VocabularyCaptureEventRow,
} from "@/services/vocabulary/vocabulary-capture.service";
import {
  mergeVocabularySurfaceForms,
  resolveVocabularyLemma,
} from "@/services/vocabulary/vocabulary-normalization.service";

type VocabularyItemRow = {
  id: string;
  student_id: string;
  lesson_id: string | null;
  item_text: string;
  item_type: string | null;
  canonical_lemma: string | null;
  captured_surface_forms: string[] | null;
  capture_count: number | null;
  first_captured_at: string | null;
  last_captured_at: string | null;
  global_content_id?: string | null;
  english_explanation: string | null;
  translated_explanation: string | null;
  translation_language: string | null;
  example_text: string | null;
  context_sentence: string | null;
  distractors: string[] | null;
  drill_answer_sets: unknown;
  audio_status: string | null;
  is_removed?: boolean;
  removed_at?: string | null;
  student_definition_override?: string | null;
  student_translation_override?: string | null;
  definition_override_generated_from_context?: boolean | null;
  definition_override_updated_at?: string | null;
  created_at: string | null;
};

type VocabularyCaptureRow = VocabularyCaptureEventRow;

type PreparedVocabularyDrillsResult = {
  preparedCount: number;
  totalItems: number;
  items: VocabularyItemRow[];
};

type GeneratedVocabularyItemsResult = {
  generatedCount: number;
  totalItems: number;
  items: VocabularyItemRow[];
};

type EnsureLessonVocabularyDrillsReadyResult = {
  generatedCount: number;
  preparedCount: number;
  totalItems: number;
  items: VocabularyItemRow[];
};

function normalizeKey(text: string) {
  return text.trim().toLowerCase();
}

function getVocabularyItemCanonicalKey(item: {
  canonical_lemma?: string | null;
  item_type?: string | null;
  item_text: string;
}) {
  if (item.canonical_lemma) {
    return normalizeKey(item.canonical_lemma);
  }

  return resolveVocabularyLemma({
    itemText: item.item_text,
    itemType: item.item_type,
  }).canonicalLemma;
}

function getAggregateCanonicalKey(item: AggregatedVocabularyCapture) {
  return normalizeKey(item.canonicalLemma);
}

function isPlaceholderVocabularyItem(item: {
  item_text: string;
  english_explanation: string | null;
  translated_explanation: string | null;
}) {
  const itemKey = normalizeKey(item.item_text);
  const english = item.english_explanation?.trim().toLowerCase() ?? "";
  const translated = item.translated_explanation?.trim().toLowerCase() ?? "";

  return (
    !english ||
    english === "meaning of this word in the passage." ||
    english === "meaning of this phrase in the passage." ||
    english === `meaning of "${itemKey}"` ||
    english === `meaning of "${itemKey}" in the passage.` ||
    translated === "" ||
    translated === itemKey
  );
}

async function listVocabularyItems(params: {
  studentId: string;
  lessonId?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("vocabulary_item_details")
    .select("*")
    .eq("student_id", params.studentId)
    .order("created_at", { ascending: true });

  if (params.lessonId) {
    query = query.eq("lesson_id", params.lessonId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as VocabularyItemRow[];
}

async function ensureVocabularyAudio(params: {
  studentId: string;
  lessonId: string;
}) {
  const supabase = await createClient();
  const { data: pendingItems, error: pendingError } = await supabase
    .from("vocabulary_item_details")
    .select("id, item_text")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .in("audio_status", ["pending", "failed"]);

  if (pendingError) {
    throw pendingError;
  }

  if ((pendingItems ?? []).length === 0) {
    return;
  }

  try {
    const generatedAudio = await generateVocabularyAudioBulk(pendingItems, {
      studentId: params.studentId,
    });

    for (const item of generatedAudio) {
      const dataUrl = `data:audio/mpeg;base64,${item.audio_base64}`;

      const { error: updateAudioError } = await supabase
        .from("vocabulary_item_details")
        .update({
          audio_url: dataUrl,
          audio_status: "ready",
        })
        .eq("id", item.id);

      if (updateAudioError) {
        console.error("updateAudioError", updateAudioError);

        await supabase
          .from("vocabulary_item_details")
          .update({ audio_status: "failed" })
          .eq("id", item.id);
      }
    }
  } catch (audioError) {
    console.error("audioError", audioError);
  }
}

export async function generateVocabularyItemsFromCaptures(params: {
  studentId: string;
  lessonId: string;
  prepareDrillAssets?: boolean;
  ensureAudio?: boolean;
  maxNewItems?: number;
  itemTexts?: string[];
}): Promise<GeneratedVocabularyItemsResult> {
  const supabase = await createClient();
  const prepareDrillAssets = params.prepareDrillAssets ?? true;
  const ensureAudio = params.ensureAudio ?? true;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, native_language")
    .eq("id", params.studentId)
    .single();

  if (studentError || !student) {
    throw studentError ?? new Error("Student not found");
  }

  const { data: captures, error: capturesError } = await supabase
    .from("vocabulary_capture_events")
    .select("item_text, item_type, context_text, created_at, metadata, canonical_lemma, captured_surface_form")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("created_at", { ascending: true });

  if (capturesError) {
    throw capturesError;
  }

  const captureAggregates = aggregateVocabularyCaptureRows(
    (captures ?? []) as VocabularyCaptureRow[]
  );

  const existingItems = await listVocabularyItems({
    studentId: params.studentId,
    lessonId: params.lessonId,
  });
  const existingItemsByKey = new Map(
    existingItems.map((item) => [getVocabularyItemCanonicalKey(item), item])
  );
  const requestedKeys = params.itemTexts?.length
    ? new Set(params.itemTexts.map((item) => normalizeKey(item)))
    : null;
  const itemsToGenerate = captureAggregates
    .filter((item) =>
      requestedKeys ? item.lookupKeys.some((key) => requestedKeys.has(normalizeKey(key))) : true
    )
    .filter((item) => {
      const existingItem = existingItemsByKey.get(getAggregateCanonicalKey(item));
      return !existingItem || isPlaceholderVocabularyItem(existingItem);
    })
    .map((item) => ({
      item_text: item.itemText,
      item_type: item.itemType,
      canonical_lemma: item.canonicalLemma,
      context_text: item.contextText,
      captured_surface_forms: item.capturedSurfaceForms,
      capture_count: item.captureCount,
      first_captured_at: item.firstCapturedAt,
      last_captured_at: item.lastCapturedAt,
      preview: item.preview,
    }))
    .slice(0, Math.max(0, params.maxNewItems ?? Number.MAX_SAFE_INTEGER));

  if (itemsToGenerate.length > 0) {
    const reusableContent = await ensureReusableVocabularyContent({
      items: itemsToGenerate.map((item) => {
        const existingItem = existingItemsByKey.get(normalizeKey(item.canonical_lemma)) ?? null;

        return {
          itemText: item.item_text,
          itemType: item.item_type as "word" | "phrase",
          canonicalLemma: item.canonical_lemma,
          fallbackEnglishExplanation:
            existingItem?.english_explanation ??
            item.preview?.plainEnglishMeaning?.trim() ??
            item.preview?.contextMeaning?.trim() ??
            null,
          fallbackTranslatedExplanation:
            existingItem?.translated_explanation ??
            item.preview?.translation?.trim() ??
            null,
          fallbackExampleText: existingItem?.example_text ?? null,
          existingDistractors: existingItem?.distractors ?? [],
          existingAnswerSets: parseVocabularyDrillAnswerSets(
            existingItem?.drill_answer_sets ?? {}
          ),
        };
      }),
      translationLanguage: student.native_language || "ru",
      requestedByStudentId: params.studentId,
      includeDrillAssets: prepareDrillAssets,
    });
    const rowsToInsert: Array<Record<string, unknown>> = [];

    for (const item of itemsToGenerate) {
      const existingItem =
        existingItemsByKey.get(normalizeKey(item.canonical_lemma)) ?? null;
      const capturePreview = item.preview ?? null;
      const cacheKey = buildVocabularyDictionaryCacheKey({
        itemText: item.item_text,
        itemType: item.item_type as "word" | "phrase",
        canonicalLemma: item.canonical_lemma,
        translationLanguage: student.native_language || "ru",
      });
      const reusableEntry = reusableContent.entryMap.get(cacheKey) ?? null;
      const englishExplanation =
        reusableEntry?.englishExplanation ??
        existingItem?.english_explanation ??
        capturePreview?.plainEnglishMeaning?.trim() ??
        capturePreview?.contextMeaning?.trim() ??
        `Meaning of "${item.item_text}"`;
      const translatedExplanation =
        reusableEntry?.translatedExplanation ??
        existingItem?.translated_explanation ??
        capturePreview?.translation?.trim() ??
        `Перевод: ${item.item_text}`;
      const exampleText =
        reusableEntry?.exampleText ??
        existingItem?.example_text ??
        null;
      const contextSentence =
        item.context_text ?? existingItem?.context_sentence ?? null;
      const distractors =
        reusableEntry?.distractors?.length
          ? reusableEntry.distractors
          : Array.isArray(existingItem?.distractors)
            ? existingItem.distractors
            : [];
      const drillAnswerSets =
        reusableEntry && hasReadyVocabularyDrillAnswerSets(reusableEntry.drillAnswerSets)
          ? parseVocabularyDrillAnswerSets(reusableEntry.drillAnswerSets)
          : parseVocabularyDrillAnswerSets(existingItem?.drill_answer_sets ?? {});

      const nextRow = {
        student_id: params.studentId,
        lesson_id: params.lessonId,
        global_content_id:
          reusableEntry?.id ?? existingItem?.global_content_id ?? null,
        item_text: existingItem?.item_text ?? item.item_text,
        item_type: item.item_type,
        canonical_lemma: item.canonical_lemma,
        captured_surface_forms: mergeVocabularySurfaceForms(
          existingItem?.captured_surface_forms ?? [],
          item.captured_surface_forms
        ),
        capture_count: Math.max(
          Number(existingItem?.capture_count ?? 0),
          Number(item.capture_count ?? 0)
        ),
        first_captured_at:
          existingItem?.first_captured_at && item.first_captured_at
            ? existingItem.first_captured_at < item.first_captured_at
              ? existingItem.first_captured_at
              : item.first_captured_at
            : existingItem?.first_captured_at ?? item.first_captured_at ?? null,
        last_captured_at:
          existingItem?.last_captured_at && item.last_captured_at
            ? existingItem.last_captured_at > item.last_captured_at
              ? existingItem.last_captured_at
              : item.last_captured_at
            : existingItem?.last_captured_at ?? item.last_captured_at ?? null,
        english_explanation: englishExplanation,
        translated_explanation: translatedExplanation,
        translation_language: student.native_language || "ru",
        example_text: exampleText,
        context_sentence: contextSentence,
        distractors,
        drill_answer_sets: drillAnswerSets,
        audio_status: existingItem?.audio_status === "ready" ? "ready" : "pending",
        is_removed: false,
        removed_at: null,
      };

      if (existingItem?.id) {
        const { error: updateError } = await supabase
          .from("vocabulary_item_details")
          .update(nextRow)
          .eq("id", existingItem.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        rowsToInsert.push(nextRow);
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("vocabulary_item_details")
        .insert(rowsToInsert);

      if (insertError) {
        throw insertError;
      }
    }
  }

  if (ensureAudio) {
    await ensureVocabularyAudio({
      studentId: params.studentId,
      lessonId: params.lessonId,
    });
  }

  const items = await hydrateVocabularyDetailsWithGlobalContent({
    details: await listVocabularyItems({
      studentId: params.studentId,
      lessonId: params.lessonId,
    }),
    translationLanguage: student.native_language || "ru",
  });

  return {
    generatedCount: itemsToGenerate.length,
    totalItems: items.length,
    items,
  };
}

export async function prepareVocabularyDrillsForStudent(params: {
  studentId: string;
  lessonId?: string;
}): Promise<PreparedVocabularyDrillsResult> {
  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, native_language")
    .eq("id", params.studentId)
    .single();

  if (studentError || !student) {
    throw studentError ?? new Error("Student not found");
  }

  const items = await listVocabularyItems({
    studentId: params.studentId,
    lessonId: params.lessonId,
  });
  const translationLanguage = student.native_language || "ru";
  const reusableContent = await ensureReusableVocabularyContent({
    items: items.map((item) => ({
      itemText: item.item_text,
      itemType: (item.item_type ?? "word") as "word" | "phrase",
      canonicalLemma: item.canonical_lemma,
      fallbackEnglishExplanation: item.english_explanation,
      fallbackTranslatedExplanation: item.translated_explanation,
      fallbackExampleText: item.example_text,
      existingDistractors: Array.isArray(item.distractors) ? item.distractors : [],
      existingAnswerSets: parseVocabularyDrillAnswerSets(item.drill_answer_sets),
    })),
    translationLanguage,
    requestedByStudentId: params.studentId,
    includeDrillAssets: true,
  });

  let preparedCount = 0;

  for (const item of items) {
    if (!item.item_text) {
      continue;
    }

    const cacheKey = buildVocabularyDictionaryCacheKey({
      itemText: item.item_text,
      itemType: item.item_type,
      canonicalLemma: item.canonical_lemma,
      translationLanguage,
    });
    const reusableEntry = reusableContent.entryMap.get(cacheKey) ?? null;
    const nextDistractors = reusableEntry?.distractors?.slice(0, 4) ?? [];
    const currentDistractors = Array.isArray(item.distractors) ? item.distractors : [];
    const currentAnswerSets = parseVocabularyDrillAnswerSets(item.drill_answer_sets);
    const nextAnswerSets =
      reusableEntry && hasReadyVocabularyDrillAnswerSets(reusableEntry.drillAnswerSets)
        ? parseVocabularyDrillAnswerSets(reusableEntry.drillAnswerSets)
        : currentAnswerSets;
    const nextEnglishExplanation =
      reusableEntry?.englishExplanation ?? item.english_explanation ?? null;
    const nextTranslatedExplanation =
      reusableEntry?.translatedExplanation ?? item.translated_explanation ?? null;
    const nextExampleText = reusableEntry?.exampleText ?? item.example_text ?? null;

    if (
      JSON.stringify(currentDistractors) === JSON.stringify(nextDistractors) &&
      JSON.stringify(currentAnswerSets) === JSON.stringify(nextAnswerSets) &&
      (item.global_content_id ?? null) === (reusableEntry?.id ?? null) &&
      (item.english_explanation ?? null) === nextEnglishExplanation &&
      (item.translated_explanation ?? null) === nextTranslatedExplanation &&
      (item.example_text ?? null) === nextExampleText
    ) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("vocabulary_item_details")
      .update({
        global_content_id: reusableEntry?.id ?? item.global_content_id ?? null,
        english_explanation: nextEnglishExplanation,
        translated_explanation: nextTranslatedExplanation,
        example_text: nextExampleText,
        distractors: nextDistractors,
        drill_answer_sets: nextAnswerSets,
      })
      .eq("id", item.id);

    if (updateError) {
      throw updateError;
    }

    preparedCount += 1;
  }

  const refreshedItems = await hydrateVocabularyDetailsWithGlobalContent({
    details: await listVocabularyItems({
      studentId: params.studentId,
      lessonId: params.lessonId,
    }),
    translationLanguage,
  });

  return {
    preparedCount,
    totalItems: refreshedItems.length,
    items: refreshedItems,
  };
}

export async function ensureLessonVocabularyDrillsReady(params: {
  studentId: string;
  lessonId: string;
  maxNewItems?: number;
  itemTexts?: string[];
}): Promise<EnsureLessonVocabularyDrillsReadyResult> {
  const generated = await generateVocabularyItemsFromCaptures({
    studentId: params.studentId,
    lessonId: params.lessonId,
    maxNewItems: params.maxNewItems,
    itemTexts: params.itemTexts,
  });
  const prepared = await prepareVocabularyDrillsForStudent({
    studentId: params.studentId,
    lessonId: params.lessonId,
  });

  return {
    generatedCount: generated.generatedCount,
    preparedCount: prepared.preparedCount,
    totalItems: prepared.totalItems,
    items: prepared.items,
  };
}
