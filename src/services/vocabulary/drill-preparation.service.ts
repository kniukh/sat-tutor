import { createClient } from "@/lib/supabase/server";
import { generateVocabularyCards } from "@/services/ai/generate-vocabulary-cards";
import { generateVocabularyAudioBulk } from "@/services/ai/generate-vocabulary-audio-bulk";
import {
  prepareVocabularyDistractors,
  prepareVocabularyDistractorsBatch,
} from "@/services/vocabulary/distractor-quality.service";
import {
  hasReadyVocabularyDrillAnswerSets,
  parseVocabularyDrillAnswerSets,
  prepareVocabularyDrillAnswerSets,
} from "@/services/vocabulary/drill-answer-sets.service";
import {
  buildVocabularyDictionaryCacheKey,
  listVocabularyDictionaryCacheEntries,
  touchVocabularyDictionaryCacheEntries,
  upsertVocabularyDictionaryCacheEntries,
} from "@/services/vocabulary/vocabulary-dictionary-cache.service";

type VocabularyItemRow = {
  id: string;
  student_id: string;
  lesson_id: string | null;
  item_text: string;
  item_type: string | null;
  english_explanation: string | null;
  translated_explanation: string | null;
  translation_language: string | null;
  example_text: string | null;
  context_sentence: string | null;
  distractors: string[] | null;
  drill_answer_sets: unknown;
  audio_status: string | null;
  created_at: string | null;
};

type VocabularyCaptureRow = {
  item_text: string;
  item_type: string | null;
  context_text: string | null;
  created_at: string | null;
  metadata?: {
    preview?: {
      plainEnglishMeaning?: string | null;
      translation?: string | null;
      contextMeaning?: string | null;
    } | null;
  } | null;
};

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

function getDictionaryCacheKey(params: {
  itemText: string;
  itemType: string | null;
  translationLanguage: string | null;
}) {
  return buildVocabularyDictionaryCacheKey({
    itemText: params.itemText,
    itemType: params.itemType,
    translationLanguage: params.translationLanguage,
  });
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
    .select("item_text, item_type, context_text, created_at, metadata")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("created_at", { ascending: true });

  if (capturesError) {
    throw capturesError;
  }

  const uniqueItems = Array.from(
    new Map(
      ((captures ?? []) as VocabularyCaptureRow[]).map((item) => [normalizeKey(item.item_text), item])
    ).values()
  );

  const existingItems = await listVocabularyItems({
    studentId: params.studentId,
    lessonId: params.lessonId,
  });
  const existingItemsByKey = new Map(
    existingItems.map((item) => [normalizeKey(item.item_text), item])
  );
  const dictionaryCacheMap = await listVocabularyDictionaryCacheEntries({
    items: uniqueItems.map((item) => ({
      itemText: item.item_text,
      itemType: item.item_type,
    })),
    translationLanguage: student.native_language || "ru",
  });
  const usedDictionaryEntries: Parameters<typeof touchVocabularyDictionaryCacheEntries>[0] = [];
  const requestedKeys = params.itemTexts?.length
    ? new Set(params.itemTexts.map((item) => normalizeKey(item)))
    : null;
  const itemsToGenerate = uniqueItems
    .filter((item) => (requestedKeys ? requestedKeys.has(normalizeKey(item.item_text)) : true))
    .filter((item) => {
      const existingItem = existingItemsByKey.get(normalizeKey(item.item_text));
      return !existingItem || isPlaceholderVocabularyItem(existingItem);
    })
    .map((item) => ({
      item_text: item.item_text,
      item_type: item.item_type ?? (item.item_text.includes(" ") ? "phrase" : "word"),
      context_text: item.context_text ?? null,
    }))
    .slice(0, Math.max(0, params.maxNewItems ?? Number.MAX_SAFE_INTEGER));

  if (itemsToGenerate.length > 0) {
    const cachedGeneratedCards = itemsToGenerate
      .map((item) => {
        const dictionaryEntry =
          dictionaryCacheMap.get(
            getDictionaryCacheKey({
              itemText: item.item_text,
              itemType: item.item_type,
              translationLanguage: student.native_language || "ru",
            })
          ) ?? null;

        if (!dictionaryEntry || !dictionaryEntry.englishExplanation.trim()) {
          return null;
        }

        usedDictionaryEntries.push(dictionaryEntry);

        return {
          item_text: item.item_text,
          english_explanation: dictionaryEntry.englishExplanation,
          translated_explanation: dictionaryEntry.translatedExplanation,
          example_text:
            dictionaryEntry.exampleText ||
            item.context_text ||
            `Example with "${item.item_text}".`,
        };
      })
      .filter(Boolean) as Array<{
      item_text: string;
      english_explanation: string;
      translated_explanation: string;
      example_text: string;
    }>;
    const cachedGeneratedKeys = new Set(
      cachedGeneratedCards.map((item) => normalizeKey(item.item_text))
    );
    const aiItemsToGenerate = itemsToGenerate.filter(
      (item) => !cachedGeneratedKeys.has(normalizeKey(item.item_text))
    );
    let generated:
      | Array<{
          item_text: string;
          english_explanation: string;
          translated_explanation: string;
          example_text: string;
        }>
      | null = null;

    if (aiItemsToGenerate.length > 0) {
      try {
        generated = await generateVocabularyCards({
          studentId: params.studentId,
          items: aiItemsToGenerate,
          nativeLanguage: student.native_language || "ru",
        });
      } catch (aiError) {
        console.error("generateVocabularyCards aiError", aiError);
      }
    }

    const generatedCards = [...cachedGeneratedCards, ...(generated ?? [])];

    if ((generated ?? []).length > 0) {
      await upsertVocabularyDictionaryCacheEntries(
        generated.map((item) => ({
          itemText: item.item_text,
          itemType: item.item_text.includes(" ") ? "phrase" : "word",
          translationLanguage: student.native_language || "ru",
          englishExplanation: item.english_explanation,
          translatedExplanation: item.translated_explanation,
          exampleText: item.example_text,
          sourceQuality: "ai_generated",
        }))
      );
    }

    const meaningPool = [
      ...generatedCards.map((item) => item.english_explanation).filter(Boolean),
    ];
    const translationPool = [
      ...generatedCards.map((item) => item.translated_explanation).filter(Boolean),
    ];
    const lexicalPool = itemsToGenerate.map((item) => item.item_text).filter(Boolean);
    const distractorBatchInputs = prepareDrillAssets
      ? itemsToGenerate.map((item) => {
          const captureSource = uniqueItems.find(
            (candidate) => normalizeKey(candidate.item_text) === normalizeKey(item.item_text)
          );
          const capturePreview = captureSource?.metadata?.preview ?? null;
          const dictionaryEntry =
            dictionaryCacheMap.get(
              getDictionaryCacheKey({
                itemText: item.item_text,
                itemType: item.item_type,
                translationLanguage: student.native_language || "ru",
              })
            ) ?? null;
          const aiCard = generatedCards.find(
            (candidate) => normalizeKey(candidate.item_text) === normalizeKey(item.item_text)
          );
          const englishExplanation =
            aiCard?.english_explanation ??
            capturePreview?.plainEnglishMeaning?.trim() ??
            capturePreview?.contextMeaning?.trim() ??
            `Meaning of "${item.item_text}"`;

          return {
            itemText: item.item_text,
            itemType: item.item_type as "word" | "phrase",
            correctAnswer: englishExplanation,
            studentId: params.studentId,
            contextSentence:
              item.context_text ?? `Context with "${item.item_text}" was not captured yet.`,
            exampleText:
              aiCard?.example_text ??
              item.context_text ??
              capturePreview?.contextMeaning?.trim() ??
              `Example with "${item.item_text}".`,
            existingDistractors: dictionaryEntry?.distractors ?? [],
            fallbackPool: meaningPool.filter(
              (candidate) =>
                candidate &&
                normalizeKey(candidate) !== normalizeKey(englishExplanation)
            ),
          };
        })
      : [];
    const distractorBatchMap = prepareDrillAssets
      ? await prepareVocabularyDistractorsBatch(distractorBatchInputs)
      : new Map<string, string[]>();
    const rowsToInsert: Array<Record<string, unknown>> = [];

    for (const item of itemsToGenerate) {
      const existingItem = existingItemsByKey.get(normalizeKey(item.item_text));
      const captureSource = uniqueItems.find(
        (candidate) => normalizeKey(candidate.item_text) === normalizeKey(item.item_text)
      );
      const capturePreview = captureSource?.metadata?.preview ?? null;
      const dictionaryEntry =
        dictionaryCacheMap.get(
          getDictionaryCacheKey({
            itemText: item.item_text,
            itemType: item.item_type,
            translationLanguage: student.native_language || "ru",
          })
        ) ?? null;
      const aiCard = generatedCards.find(
        (candidate) => normalizeKey(candidate.item_text) === normalizeKey(item.item_text)
      );
      const englishExplanation =
        aiCard?.english_explanation ??
        capturePreview?.plainEnglishMeaning?.trim() ??
        capturePreview?.contextMeaning?.trim() ??
        `Meaning of "${item.item_text}"`;
      const exampleText =
        aiCard?.example_text ??
        item.context_text ??
        capturePreview?.contextMeaning?.trim() ??
        `Example with "${item.item_text}".`;
      const contextSentence =
        item.context_text ?? `Context with "${item.item_text}" was not captured yet.`;
      let distractors: string[] = [];
      let drillAnswerSets: ReturnType<typeof parseVocabularyDrillAnswerSets> =
        parseVocabularyDrillAnswerSets({});

      if (dictionaryEntry?.distractors?.length) {
        distractors = dictionaryEntry.distractors;
      }

      if (
        dictionaryEntry &&
        hasReadyVocabularyDrillAnswerSets(dictionaryEntry.drillAnswerSets)
      ) {
        drillAnswerSets = parseVocabularyDrillAnswerSets(dictionaryEntry.drillAnswerSets);
      }

      if (
        prepareDrillAssets &&
        (!distractors.length || !hasReadyVocabularyDrillAnswerSets(drillAnswerSets))
      ) {
        if (!distractors.length) {
          distractors =
            distractorBatchMap.get(
              `${normalizeKey(item.item_text)}::${normalizeKey(englishExplanation)}`
            ) ??
            (await prepareVocabularyDistractors({
              itemText: item.item_text,
              itemType: item.item_type as "word" | "phrase",
              correctAnswer: englishExplanation,
              studentId: params.studentId,
              contextSentence,
              exampleText,
              fallbackPool: meaningPool.filter(
                (candidate) =>
                  candidate &&
                  normalizeKey(candidate) !== normalizeKey(englishExplanation)
              ),
            }));
        }

        drillAnswerSets = await prepareVocabularyDrillAnswerSets({
          itemText: item.item_text,
          itemType: item.item_type as "word" | "phrase",
          englishExplanation,
          studentId: params.studentId,
          translatedExplanation: aiCard?.translated_explanation ?? null,
          contextSentence,
          exampleText,
          meaningFallbackPool: meaningPool.filter(
            (candidate) => candidate && normalizeKey(candidate) !== normalizeKey(englishExplanation)
          ),
          translationFallbackPool: translationPool.filter(
            (candidate) =>
              candidate &&
              normalizeKey(candidate) !== normalizeKey(aiCard?.translated_explanation ?? "")
          ),
          lexicalFallbackPool: lexicalPool.filter(
            (candidate) => normalizeKey(candidate) !== normalizeKey(item.item_text)
          ),
        });
      }

      if (prepareDrillAssets) {
        await upsertVocabularyDictionaryCacheEntries([
          {
            itemText: item.item_text,
            itemType: item.item_type as "word" | "phrase",
            translationLanguage: student.native_language || "ru",
            englishExplanation,
            translatedExplanation:
              aiCard?.translated_explanation ??
              capturePreview?.translation?.trim() ??
              `Перевод: ${item.item_text}`,
            exampleText,
            distractors,
            drillAnswerSets,
            sourceQuality: "ai_generated",
          },
        ]);
      }

      const nextRow = {
        student_id: params.studentId,
        lesson_id: params.lessonId,
        item_text: item.item_text,
        item_type: item.item_type,
        english_explanation: englishExplanation,
        translated_explanation:
          aiCard?.translated_explanation ??
          capturePreview?.translation?.trim() ??
          `Перевод: ${item.item_text}`,
        translation_language: student.native_language || "ru",
        example_text: exampleText,
        context_sentence: contextSentence,
        distractors,
        drill_answer_sets: drillAnswerSets,
        audio_status: "pending",
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

  if (usedDictionaryEntries.length > 0) {
    await touchVocabularyDictionaryCacheEntries(usedDictionaryEntries);
  }

  if (ensureAudio) {
    await ensureVocabularyAudio({
      studentId: params.studentId,
      lessonId: params.lessonId,
    });
  }

  const items = await listVocabularyItems({
    studentId: params.studentId,
    lessonId: params.lessonId,
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
  const dictionaryCacheMap = await listVocabularyDictionaryCacheEntries({
    items: items.map((item) => ({
      itemText: item.item_text,
      itemType: item.item_type,
    })),
    translationLanguage,
  });
  const usedDictionaryEntries: Parameters<typeof touchVocabularyDictionaryCacheEntries>[0] = [];
  const meaningPool = items
    .map((item) => item.english_explanation)
    .filter((value): value is string => Boolean(value));
  const translationPool = items
    .map((item) => item.translated_explanation)
    .filter((value): value is string => Boolean(value));
  const lexicalPool = items
    .map((item) => item.item_text)
    .filter((value): value is string => Boolean(value));
  const distractorBatchInputs = items
    .filter((item) => item.item_text && item.english_explanation)
    .map((item) => ({
      itemText: item.item_text,
      itemType: (item.item_type ?? "word") as "word" | "phrase",
      correctAnswer: item.english_explanation as string,
      studentId: params.studentId,
      contextSentence: item.context_sentence ?? null,
      exampleText: item.example_text ?? null,
      existingDistractors: dictionaryCacheMap.get(
        getDictionaryCacheKey({
          itemText: item.item_text,
          itemType: item.item_type,
          translationLanguage,
        })
      )?.distractors ?? (Array.isArray(item.distractors) ? item.distractors : []),
      fallbackPool: meaningPool.filter(
        (candidate) => normalizeKey(candidate) !== normalizeKey(item.english_explanation ?? "")
      ),
    }));
  const distractorBatchMap = await prepareVocabularyDistractorsBatch(distractorBatchInputs);

  let preparedCount = 0;

  for (const item of items) {
    if (!item.item_text || !item.english_explanation) {
      continue;
    }

    const dictionaryEntry =
      dictionaryCacheMap.get(
        getDictionaryCacheKey({
          itemText: item.item_text,
          itemType: item.item_type,
          translationLanguage,
        })
      ) ?? null;
    let distractors = dictionaryEntry?.distractors?.length
      ? dictionaryEntry.distractors
      : [];
    let drillAnswerSets =
      dictionaryEntry && hasReadyVocabularyDrillAnswerSets(dictionaryEntry.drillAnswerSets)
        ? parseVocabularyDrillAnswerSets(dictionaryEntry.drillAnswerSets)
        : parseVocabularyDrillAnswerSets(item.drill_answer_sets);

    if (
      dictionaryEntry &&
      (dictionaryEntry.distractors?.length ||
        hasReadyVocabularyDrillAnswerSets(dictionaryEntry.drillAnswerSets))
    ) {
      usedDictionaryEntries.push(dictionaryEntry);
    }

    if (!distractors.length) {
      distractors =
        distractorBatchMap.get(
          `${normalizeKey(item.item_text)}::${normalizeKey(item.english_explanation)}`
        ) ??
        (await prepareVocabularyDistractors({
          itemText: item.item_text,
          itemType: (item.item_type ?? "word") as "word" | "phrase",
          correctAnswer: item.english_explanation,
          studentId: params.studentId,
          contextSentence: item.context_sentence ?? null,
          exampleText: item.example_text ?? null,
          existingDistractors: Array.isArray(item.distractors) ? item.distractors : [],
          fallbackPool: meaningPool.filter(
            (candidate) =>
              normalizeKey(candidate) !== normalizeKey(item.english_explanation ?? "")
          ),
        }));
    }

    if (!hasReadyVocabularyDrillAnswerSets(drillAnswerSets)) {
      drillAnswerSets = await prepareVocabularyDrillAnswerSets({
      itemText: item.item_text,
      itemType: (item.item_type ?? "word") as "word" | "phrase",
      englishExplanation: item.english_explanation,
      studentId: params.studentId,
      translatedExplanation: item.translated_explanation ?? null,
      contextSentence: item.context_sentence ?? null,
      exampleText: item.example_text ?? null,
      existingAnswerSets: parseVocabularyDrillAnswerSets(item.drill_answer_sets),
      meaningFallbackPool: meaningPool.filter(
        (candidate) => normalizeKey(candidate) !== normalizeKey(item.english_explanation ?? "")
      ),
      translationFallbackPool: translationPool.filter(
        (candidate) =>
          normalizeKey(candidate) !== normalizeKey(item.translated_explanation ?? "")
      ),
      lexicalFallbackPool: lexicalPool.filter(
        (candidate) => normalizeKey(candidate) !== normalizeKey(item.item_text)
      ),
      });
    }

    await upsertVocabularyDictionaryCacheEntries([
      {
        itemText: item.item_text,
        itemType: (item.item_type ?? "word") as "word" | "phrase",
        translationLanguage,
        englishExplanation: item.english_explanation,
        translatedExplanation: item.translated_explanation ?? item.item_text,
        exampleText: item.example_text ?? item.context_sentence ?? null,
        distractors,
        drillAnswerSets,
        sourceQuality: "ai_generated",
      },
    ]);

    const nextDistractors = distractors.slice(0, 4);
    const currentDistractors = Array.isArray(item.distractors) ? item.distractors : [];
    const currentAnswerSets = parseVocabularyDrillAnswerSets(item.drill_answer_sets);

    if (
      JSON.stringify(currentDistractors) === JSON.stringify(nextDistractors) &&
      JSON.stringify(currentAnswerSets) === JSON.stringify(drillAnswerSets)
    ) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("vocabulary_item_details")
      .update({
        distractors: nextDistractors,
        drill_answer_sets: drillAnswerSets,
      })
      .eq("id", item.id);

    if (updateError) {
      throw updateError;
    }

    preparedCount += 1;
  }

  if (usedDictionaryEntries.length > 0) {
    await touchVocabularyDictionaryCacheEntries(usedDictionaryEntries);
  }

  const refreshedItems = await listVocabularyItems({
    studentId: params.studentId,
    lessonId: params.lessonId,
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
