import { createClient } from "@/lib/supabase/server";
import { generateInlineVocabularyPreview } from "@/services/ai/generate-inline-vocabulary-preview";
import { hydrateVocabularyDetailsWithGlobalContent } from "@/services/vocabulary/drill-content-engine.service";

export type StudentVocabularyItemRow = {
  id: string;
  student_id: string;
  lesson_id: string | null;
  item_text: string;
  item_type: string | null;
  canonical_lemma: string | null;
  global_content_id?: string | null;
  english_explanation: string | null;
  translated_explanation: string | null;
  translation_language: string | null;
  example_text: string | null;
  context_sentence: string | null;
  audio_url: string | null;
  audio_status: "ready" | "pending" | "failed" | "missing" | null;
  captured_surface_forms?: string[] | null;
  capture_count?: number | null;
  first_captured_at?: string | null;
  last_captured_at?: string | null;
  lifecycle_state?: string | null;
  review_bucket?:
    | "recently_failed"
    | "weak_again"
    | "overdue"
    | "reinforcement"
    | "scheduled"
    | null;
  review_ready?: boolean;
  student_definition_override?: string | null;
  student_translation_override?: string | null;
  definition_override_generated_from_context?: boolean | null;
  definition_override_updated_at?: string | null;
  is_removed?: boolean;
  removed_at?: string | null;
  created_at?: string | null;
};

export type StudentVocabularyListPageData = {
  student: {
    id: string;
    fullName: string;
    accessCode: string;
  };
  items: StudentVocabularyItemRow[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function hydrateStudentVocabularyItems(params: {
  studentId: string;
  translationLanguage: string;
  items: StudentVocabularyItemRow[];
}) {
  const hydrated = await hydrateVocabularyDetailsWithGlobalContent({
    details: params.items as any[],
    translationLanguage: params.translationLanguage,
  });

  return hydrated as StudentVocabularyItemRow[];
}

async function listActiveStudentVocabularyItems(params: {
  studentId: string;
  translationLanguage: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocabulary_item_details")
    .select("*")
    .eq("student_id", params.studentId)
    .eq("is_removed", false)
    .order("last_captured_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return hydrateStudentVocabularyItems({
    studentId: params.studentId,
    translationLanguage: params.translationLanguage,
    items: (data ?? []) as StudentVocabularyItemRow[],
  });
}

async function getLatestCaptureContext(params: {
  studentId: string;
  lessonId?: string | null;
  canonicalLemma?: string | null;
  itemText: string;
}) {
  const supabase = await createClient();

  const executeLookup = async (lessonScoped: boolean) => {
    let query = supabase
      .from("vocabulary_capture_events")
      .select("context_text, created_at")
      .eq("student_id", params.studentId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (lessonScoped && params.lessonId) {
      query = query.eq("lesson_id", params.lessonId);
    }

    if (params.canonicalLemma?.trim()) {
      query = query.eq("canonical_lemma", params.canonicalLemma.trim().toLowerCase());
    } else {
      query = query.eq("item_text", params.itemText.trim().toLowerCase());
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return typeof data?.context_text === "string" ? data.context_text.trim() : "";
  };

  const lessonScopedContext = await executeLookup(true);
  if (lessonScopedContext) {
    return lessonScopedContext;
  }

  return executeLookup(false);
}

async function getStudentVocabularyItemForMutation(params: {
  studentId: string;
  vocabularyItemId: string;
}) {
  const supabase = await createClient();
  const [{ data: student, error: studentError }, { data: item, error: itemError }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, access_code, native_language")
        .eq("id", params.studentId)
        .single(),
      supabase
        .from("vocabulary_item_details")
        .select("*")
        .eq("student_id", params.studentId)
        .eq("id", params.vocabularyItemId)
        .maybeSingle(),
    ]);

  if (studentError || !student) {
    throw studentError ?? new Error("Student not found");
  }

  if (itemError) {
    throw itemError;
  }

  if (!item) {
    throw new Error("Vocabulary item not found");
  }

  return {
    student,
    item: item as StudentVocabularyItemRow,
  };
}

export async function getStudentVocabularyListPageData(
  accessCode: string
): Promise<StudentVocabularyListPageData> {
  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, access_code, native_language")
    .eq("access_code", accessCode)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    throw studentError ?? new Error("Student not found");
  }

  const items = await listActiveStudentVocabularyItems({
    studentId: student.id,
    translationLanguage: student.native_language || "ru",
  });

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      accessCode: student.access_code,
    },
    items,
  };
}

export async function softRemoveStudentVocabularyItem(params: {
  studentId: string;
  vocabularyItemId: string;
}) {
  const supabase = await createClient();
  const { item } = await getStudentVocabularyItemForMutation(params);
  const nowIso = new Date().toISOString();

  const { error: removeError } = await supabase
    .from("vocabulary_item_details")
    .update({
      is_removed: true,
      removed_at: nowIso,
    })
    .eq("student_id", params.studentId)
    .eq("id", params.vocabularyItemId);

  if (removeError) {
    throw removeError;
  }

  const { data: progressRows, error: progressError } = await supabase
    .from("word_progress")
    .select("id, metadata")
    .eq("student_id", params.studentId)
    .eq("word_id", item.id);

  if (progressError) {
    throw progressError;
  }

  for (const row of progressRows ?? []) {
    const metadata = isPlainObject(row.metadata) ? row.metadata : {};
    const { error: updateProgressError } = await supabase
      .from("word_progress")
      .update({
        word_id: null,
        updated_at: nowIso,
        metadata: {
          ...metadata,
          removed_from_vocabulary: true,
          removed_from_vocabulary_at: nowIso,
        },
      })
      .eq("id", row.id);

    if (updateProgressError) {
      throw updateProgressError;
    }
  }

  const { error: cancelQueueError } = await supabase
    .from("review_queue")
    .update({
      status: "cancelled",
      updated_at: nowIso,
    })
    .eq("student_id", params.studentId)
    .eq("word_id", item.id)
    .in("status", ["pending", "scheduled"]);

  if (cancelQueueError) {
    throw cancelQueueError;
  }

  return {
    id: item.id,
    itemText: item.item_text,
    removedAt: nowIso,
  };
}

export async function regenerateStudentVocabularyMeaningOverride(params: {
  studentId: string;
  vocabularyItemId: string;
  contextText?: string | null;
}) {
  const supabase = await createClient();
  const { student, item } = await getStudentVocabularyItemForMutation(params);

  const explicitContext = params.contextText?.trim() || "";
  const latestCaptureContext = explicitContext
    ? ""
    : await getLatestCaptureContext({
        studentId: params.studentId,
        lessonId: item.lesson_id,
        canonicalLemma: item.canonical_lemma,
        itemText: item.item_text,
      });
  const sourceText =
    explicitContext ||
    latestCaptureContext ||
    item.context_sentence?.trim() ||
    item.example_text?.trim() ||
    item.item_text;
  const generatedFromContext =
    Boolean(sourceText.trim()) &&
    sourceText.trim().toLowerCase() !== item.item_text.trim().toLowerCase();
  const preview = await generateInlineVocabularyPreview({
    nativeLanguage: student.native_language || "ru",
    passageText: sourceText,
    itemText: item.item_text,
    itemType: item.item_type === "phrase" ? "phrase" : "word",
    studentId: params.studentId,
  });
  const nextDefinition =
    preview.context_meaning?.trim() ||
    preview.plain_english_meaning?.trim() ||
    item.english_explanation?.trim() ||
    item.student_definition_override?.trim() ||
    null;
  const nextTranslation =
    preview.translation?.trim() ||
    item.translated_explanation?.trim() ||
    item.student_translation_override?.trim() ||
    null;
  const updatedAt = new Date().toISOString();

  const { data: updatedItem, error: updateError } = await supabase
    .from("vocabulary_item_details")
    .update({
      student_definition_override: nextDefinition,
      student_translation_override: nextTranslation,
      definition_override_generated_from_context: generatedFromContext,
      definition_override_updated_at: updatedAt,
      is_removed: false,
      removed_at: null,
    })
    .eq("student_id", params.studentId)
    .eq("id", params.vocabularyItemId)
    .select("*")
    .single();

  if (updateError || !updatedItem) {
    throw updateError ?? new Error("Failed to update vocabulary item");
  }

  const hydratedItems = await hydrateStudentVocabularyItems({
    studentId: params.studentId,
    translationLanguage: student.native_language || "ru",
    items: [updatedItem as StudentVocabularyItemRow],
  });

  return hydratedItems[0] ?? (updatedItem as StudentVocabularyItemRow);
}
