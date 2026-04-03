import { createClient } from "@/lib/supabase/server";
import { generateVocabularyItemsFromCaptures } from "@/services/vocabulary/drill-preparation.service";

export type LessonStage =
  | "first_read"
  | "vocab_review"
  | "second_read"
  | "questions"
  | "completed";

export type StudentAnswer = {
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D" | null;
  skill?: string | null;
  answeredAt: string;
};

type CapturedVocabularyItem = {
  itemText: string;
  itemType: "word" | "phrase";
  sourceType: "passage" | "question" | "answer";
  contextText?: string | null;
  preview?: {
    plainEnglishMeaning?: string | null;
    translation?: string | null;
    contextMeaning?: string | null;
  } | null;
};

function buildFallbackLessonVocabularyItems(params: {
  studentId: string;
  lessonId: string;
  items: Array<{
    item_text: string;
    item_type: "word" | "phrase";
    context_text: string | null;
    preview?: {
      plainEnglishMeaning?: string | null;
      translation?: string | null;
      contextMeaning?: string | null;
    } | null;
  }>;
}) {
  return params.items.map((item, index) => ({
    id: `fallback:${params.lessonId}:${index}:${item.item_text.toLowerCase()}`,
    student_id: params.studentId,
    lesson_id: params.lessonId,
    item_text: item.item_text,
    item_type: item.item_type,
    english_explanation:
      item.preview?.plainEnglishMeaning?.trim() ||
      item.preview?.contextMeaning?.trim() ||
      `Meaning of "${item.item_text}" in the passage.`,
    translated_explanation: item.preview?.translation?.trim() || null,
    translation_language: null,
    example_text: item.context_text ?? item.preview?.contextMeaning?.trim() ?? null,
    context_sentence: item.context_text ?? item.preview?.contextMeaning?.trim() ?? null,
    distractors: null,
    drill_answer_sets: null,
    audio_status: null,
    created_at: null,
  }));
}

async function listLessonVocabularyItems(studentId: string, lessonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocabulary_item_details")
    .select("*")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getOrCreateLessonState(studentId: string, lessonId: string) {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("student_lesson_state")
    .select("*")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("student_lesson_state")
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      stage: "first_read",
      vocab_submitted: false,
      second_read_done: false,
      question_answers_json: {},
      current_question_index: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateStudentLessonState(studentId: string, lessonId: string) {
  return getOrCreateLessonState(studentId, lessonId);
}

export async function submitVocabulary(studentId: string, lessonId: string) {
  const supabase = await createClient();
  const state = await getOrCreateLessonState(studentId, lessonId);

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update({
      vocab_submitted: true,
      stage: "vocab_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markSecondReadDone(studentId: string, lessonId: string) {
  const supabase = await createClient();
  const state = await getOrCreateLessonState(studentId, lessonId);

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update({
      second_read_done: true,
      stage: "questions",
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveQuestionProgress(params: {
  studentId: string;
  lessonId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
  skill?: string;
}) {
  const supabase = await createClient();

  const state = await getOrCreateLessonState(params.studentId, params.lessonId);
  const answers = (state.question_answers_json ?? {}) as Record<string, StudentAnswer>;

  answers[params.questionId] = {
    questionId: params.questionId,
    selectedOption: params.selectedOption,
    skill: params.skill ?? null,
    answeredAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update({
      question_answers_json: answers,
      current_question_index: Object.keys(answers).length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function submitLessonVocabularyReview(params: {
  studentId: string;
  lessonId: string;
  passageId?: string | null;
  items?: CapturedVocabularyItem[];
}) {
  const supabase = await createClient();
  const inputItems = params.items ?? [];
  const dedupedItems = Array.from(
    new Map(
      inputItems
        .map((item) => ({
          item_text: item.itemText.trim(),
          item_type: item.itemType,
          source_type: item.sourceType,
          context_text: item.contextText?.trim() || null,
          preview: item.preview ?? null,
        }))
        .filter((item) => item.item_text)
        .map((item) => [item.item_text.toLowerCase(), item])
    ).values()
  );

  if (dedupedItems.length > 0) {
    const { error: captureError } = await supabase
      .from("vocabulary_capture_events")
      .insert(
        dedupedItems.map((item) => ({
          student_id: params.studentId,
          lesson_id: params.lessonId,
          passage_id: params.passageId ?? null,
          item_text: item.item_text,
          item_type: item.item_type,
          context_text: item.context_text,
          source_type: item.source_type,
          metadata: {
            preview: item.preview ?? null,
          },
        }))
      );

    if (captureError) {
      throw captureError;
    }
  }

  const state = await submitVocabulary(params.studentId, params.lessonId);
  let generatedCount = 0;
  let totalItems = 0;
  let items = await listLessonVocabularyItems(params.studentId, params.lessonId);

  try {
    const generated = await generateVocabularyItemsFromCaptures({
      studentId: params.studentId,
      lessonId: params.lessonId,
      prepareDrillAssets: false,
      ensureAudio: false,
    });

    generatedCount = generated.generatedCount;
    totalItems = generated.totalItems;
    items = generated.items;
  } catch (error) {
    console.error("submitLessonVocabularyReview generation error", error);

    if (items.length === 0 && dedupedItems.length > 0) {
      items = buildFallbackLessonVocabularyItems({
        studentId: params.studentId,
        lessonId: params.lessonId,
        items: dedupedItems,
      });
    }

    totalItems = items.length;
  }

  if (items.length === 0 && dedupedItems.length > 0) {
    items = buildFallbackLessonVocabularyItems({
      studentId: params.studentId,
      lessonId: params.lessonId,
      items: dedupedItems,
    });
    totalItems = items.length;
  }

  return {
    state,
    generatedCount,
    totalItems,
    items,
  };
}

export async function updateStudentLessonStage(params: {
  studentId: string;
  lessonId: string;
  stage: LessonStage;
  vocabSubmitted?: boolean;
  secondReadDone?: boolean;
}) {
  const supabase = await createClient();

  await getOrCreateLessonState(params.studentId, params.lessonId);

  const updatePayload: {
    stage: LessonStage;
    updated_at: string;
    vocab_submitted?: boolean;
    second_read_done?: boolean;
  } = {
    stage: params.stage,
    updated_at: new Date().toISOString(),
  };

  if (typeof params.vocabSubmitted === "boolean") {
    updatePayload.vocab_submitted = params.vocabSubmitted;
  }

  if (typeof params.secondReadDone === "boolean") {
    updatePayload.second_read_done = params.secondReadDone;
  }

  const { data, error } = await supabase
    .from("student_lesson_state")
    .update(updatePayload)
    .eq("id", (await getOrCreateLessonState(params.studentId, params.lessonId)).id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
