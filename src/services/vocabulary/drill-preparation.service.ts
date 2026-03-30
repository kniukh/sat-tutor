import { createClient } from "@/lib/supabase/server";
import { generateVocabularyCards } from "@/services/ai/generate-vocabulary-cards";
import { generateVocabularyAudioBulk } from "@/services/ai/generate-vocabulary-audio-bulk";
import { prepareVocabularyDistractors } from "@/services/vocabulary/distractor-quality.service";
import {
  parseVocabularyDrillAnswerSets,
  prepareVocabularyDrillAnswerSets,
} from "@/services/vocabulary/drill-answer-sets.service";

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
    const generatedAudio = await generateVocabularyAudioBulk(pendingItems);

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
}): Promise<GeneratedVocabularyItemsResult> {
  const supabase = await createClient();

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
    .select("item_text, item_type, context_text, created_at")
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
  const existingKeys = new Set(existingItems.map((item) => normalizeKey(item.item_text)));
  const itemsToGenerate = uniqueItems
    .filter((item) => !existingKeys.has(normalizeKey(item.item_text)))
    .map((item) => ({
      item_text: item.item_text,
      item_type: item.item_type ?? (item.item_text.includes(" ") ? "phrase" : "word"),
      context_text: item.context_text ?? null,
    }));

  if (itemsToGenerate.length > 0) {
    let generated:
      | Array<{
          item_text: string;
          english_explanation: string;
          translated_explanation: string;
          example_text: string;
        }>
      | null = null;

    try {
      generated = await generateVocabularyCards({
        items: itemsToGenerate,
        nativeLanguage: student.native_language || "ru",
      });
    } catch (aiError) {
      console.error("generateVocabularyCards aiError", aiError);
    }

    const meaningPool = [
      ...(generated ?? []).map((item) => item.english_explanation).filter(Boolean),
    ];
    const translationPool = [
      ...(generated ?? []).map((item) => item.translated_explanation).filter(Boolean),
    ];
    const lexicalPool = itemsToGenerate.map((item) => item.item_text).filter(Boolean);

    for (const item of itemsToGenerate) {
      const aiCard = generated?.find(
        (candidate) => normalizeKey(candidate.item_text) === normalizeKey(item.item_text)
      );
      const englishExplanation =
        aiCard?.english_explanation ?? `Meaning of "${item.item_text}"`;
      const exampleText =
        aiCard?.example_text ?? `Example with "${item.item_text}".`;
      const contextSentence =
        item.context_text ?? `Context with "${item.item_text}" was not captured yet.`;
      const distractors = await prepareVocabularyDistractors({
        itemText: item.item_text,
        itemType: item.item_type as "word" | "phrase",
        correctAnswer: englishExplanation,
        contextSentence,
        exampleText,
        fallbackPool: meaningPool.filter(
          (candidate) => candidate && normalizeKey(candidate) !== normalizeKey(englishExplanation)
        ),
      });
      const drillAnswerSets = await prepareVocabularyDrillAnswerSets({
        itemText: item.item_text,
        itemType: item.item_type as "word" | "phrase",
        englishExplanation,
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

      const { error: insertError } = await supabase
        .from("vocabulary_item_details")
        .insert({
          student_id: params.studentId,
          lesson_id: params.lessonId,
          item_text: item.item_text,
          item_type: item.item_type,
          english_explanation: englishExplanation,
          translated_explanation:
            aiCard?.translated_explanation ?? `Перевод: ${item.item_text}`,
          translation_language: student.native_language || "ru",
          example_text: exampleText,
          context_sentence: contextSentence,
          distractors,
          drill_answer_sets: drillAnswerSets,
          audio_status: "pending",
        });

      if (insertError) {
        throw insertError;
      }
    }
  }

  await ensureVocabularyAudio({
    studentId: params.studentId,
    lessonId: params.lessonId,
  });

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
  const items = await listVocabularyItems({
    studentId: params.studentId,
    lessonId: params.lessonId,
  });
  const meaningPool = items
    .map((item) => item.english_explanation)
    .filter((value): value is string => Boolean(value));
  const translationPool = items
    .map((item) => item.translated_explanation)
    .filter((value): value is string => Boolean(value));
  const lexicalPool = items
    .map((item) => item.item_text)
    .filter((value): value is string => Boolean(value));

  let preparedCount = 0;

  for (const item of items) {
    if (!item.item_text || !item.english_explanation) {
      continue;
    }

    const distractors = await prepareVocabularyDistractors({
      itemText: item.item_text,
      itemType: (item.item_type ?? "word") as "word" | "phrase",
      correctAnswer: item.english_explanation,
      contextSentence: item.context_sentence ?? null,
      exampleText: item.example_text ?? null,
      existingDistractors: Array.isArray(item.distractors) ? item.distractors : [],
      fallbackPool: meaningPool.filter(
        (candidate) => normalizeKey(candidate) !== normalizeKey(item.english_explanation ?? "")
      ),
    });
    const drillAnswerSets = await prepareVocabularyDrillAnswerSets({
      itemText: item.item_text,
      itemType: (item.item_type ?? "word") as "word" | "phrase",
      englishExplanation: item.english_explanation,
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
}): Promise<EnsureLessonVocabularyDrillsReadyResult> {
  const generated = await generateVocabularyItemsFromCaptures({
    studentId: params.studentId,
    lessonId: params.lessonId,
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
