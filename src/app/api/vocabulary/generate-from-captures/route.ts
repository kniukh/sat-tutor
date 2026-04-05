import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { generateVocabularyItemsFromCaptures } from "@/services/vocabulary/drill-preparation.service";

type ExistingVocabularyItemRow = {
  id: string;
  item_text: string;
  item_type?: string | null;
  english_explanation: string | null;
  translated_explanation: string | null;
  example_text: string | null;
  context_sentence: string | null;
  audio_status?: string | null;
  audio_url?: string | null;
};

type CaptureFallbackRow = {
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

function normalizeKey(text: string) {
  return text.trim().toLowerCase();
}

async function buildDegradedVocabularyItems(params: {
  studentId: string;
  lessonId: string;
  itemTexts?: string[];
  limit?: number;
}) {
  const supabase = await createClient();
  const requestedKeys = params.itemTexts?.length
    ? new Set(params.itemTexts.map((item) => normalizeKey(item)))
    : null;
  const limit =
    typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(0, Math.floor(params.limit))
      : undefined;

  const { data: existingRows, error: existingError } = await supabase
    .from("vocabulary_item_details")
    .select("id, item_text, item_type, english_explanation, translated_explanation, example_text, context_sentence, audio_status, audio_url")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("created_at", { ascending: true });

  if (existingError) {
    throw existingError;
  }

  const existingItems = ((existingRows ?? []) as ExistingVocabularyItemRow[])
    .filter((item) => (requestedKeys ? requestedKeys.has(normalizeKey(item.item_text)) : true))
    .slice(0, limit ?? Number.MAX_SAFE_INTEGER);
  const existingItemsByKey = new Map(
    existingItems.map((item) => [normalizeKey(item.item_text), item])
  );

  const { data: captureRows, error: captureError } = await supabase
    .from("vocabulary_capture_events")
    .select("item_text, item_type, context_text, created_at, metadata")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("created_at", { ascending: true });

  if (captureError) {
    throw captureError;
  }

  const uniqueCaptures = Array.from(
    new Map(
      ((captureRows ?? []) as CaptureFallbackRow[])
        .filter((item) => (requestedKeys ? requestedKeys.has(normalizeKey(item.item_text)) : true))
        .map((item) => [normalizeKey(item.item_text), item])
    ).values()
  ).slice(0, limit ?? Number.MAX_SAFE_INTEGER);

  const missingRows = uniqueCaptures
    .filter((item) => !existingItemsByKey.has(normalizeKey(item.item_text)))
    .map((item) => ({
      student_id: params.studentId,
      lesson_id: params.lessonId,
      item_text: item.item_text,
      item_type: item.item_type ?? (item.item_text.includes(" ") ? "phrase" : "word"),
      english_explanation:
        item.metadata?.preview?.plainEnglishMeaning?.trim() ||
        item.metadata?.preview?.contextMeaning?.trim() ||
        `Meaning of "${item.item_text}" in this lesson.`,
      translated_explanation: item.metadata?.preview?.translation?.trim() || null,
      example_text:
        item.context_text ??
        item.metadata?.preview?.contextMeaning?.trim() ??
        null,
      context_sentence:
        item.context_text ??
        item.metadata?.preview?.contextMeaning?.trim() ??
        null,
      audio_status: "pending",
    }));

  if (missingRows.length > 0) {
    const { error: insertError } = await supabase
      .from("vocabulary_item_details")
      .insert(missingRows);

    if (insertError) {
      console.error("generate-from-captures degraded insert error", insertError);
    } else {
      const { data: refreshedRows, error: refreshedError } = await supabase
        .from("vocabulary_item_details")
        .select("id, item_text, item_type, english_explanation, translated_explanation, example_text, context_sentence, audio_status, audio_url")
        .eq("student_id", params.studentId)
        .eq("lesson_id", params.lessonId)
        .order("created_at", { ascending: true });

      if (!refreshedError) {
        const refreshedItems = ((refreshedRows ?? []) as ExistingVocabularyItemRow[])
          .filter((item) => (requestedKeys ? requestedKeys.has(normalizeKey(item.item_text)) : true))
          .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

        if (refreshedItems.length > 0) {
          return refreshedItems;
        }
      }
    }
  }

  if (existingItems.length > 0) {
    return existingItems;
  }

  return uniqueCaptures.map((item, index) => ({
    id: `degraded:${params.lessonId}:${index}:${normalizeKey(item.item_text)}`,
    item_type: item.item_type ?? (item.item_text.includes(" ") ? "phrase" : "word"),
    item_text: item.item_text,
    english_explanation:
      item.metadata?.preview?.plainEnglishMeaning?.trim() ||
      item.metadata?.preview?.contextMeaning?.trim() ||
      `Meaning of "${item.item_text}" in this lesson.`,
    translated_explanation: item.metadata?.preview?.translation?.trim() || null,
    example_text:
      item.context_text ??
      item.metadata?.preview?.contextMeaning?.trim() ??
      null,
    context_sentence:
      item.context_text ??
      item.metadata?.preview?.contextMeaning?.trim() ??
      null,
    audio_status: "pending",
    audio_url: null,
  }));
}

export async function POST(request: Request) {
  let lessonId: string | undefined;
  let sessionStudentId: string | undefined;
  let limit: number | undefined;
  let itemTexts: string[] | undefined;

  try {
    const body = await request.json();
    const { studentId } = body;
    lessonId = typeof body.lessonId === "string" ? body.lessonId : undefined;
    limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(0, Math.floor(body.limit))
        : undefined;
    itemTexts = Array.isArray(body.itemTexts)
      ? body.itemTexts.filter((item): item is string => typeof item === "string")
      : undefined;

    if (!lessonId) {
      return NextResponse.json(
        { error: "studentId and lessonId are required" },
        { status: 400 }
      );
    }

    sessionStudentId = await requireStudentApiStudentId(studentId);

    try {
      const result = await generateVocabularyItemsFromCaptures({
        studentId: sessionStudentId,
        lessonId,
        prepareDrillAssets: false,
        ensureAudio: false,
        maxNewItems: limit,
        itemTexts,
      });

      return NextResponse.json({ ok: true, items: result.items, result });
    } catch (generationError) {
      console.error("generate-from-captures generation error", generationError);

      const degradedItems = await buildDegradedVocabularyItems({
        studentId: sessionStudentId,
        lessonId,
        itemTexts,
        limit,
      });

      return NextResponse.json({
        ok: true,
        degraded: true,
        items: degradedItems,
      });
    }
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (lessonId && sessionStudentId) {
      try {
        const degradedItems = await buildDegradedVocabularyItems({
          studentId: sessionStudentId,
          lessonId,
          itemTexts,
          limit,
        });

        return NextResponse.json({
          ok: true,
          degraded: true,
          items: degradedItems,
        });
      } catch (fallbackError) {
        console.error("generate-from-captures degraded fallback error", fallbackError);
      }
    }

    console.error("generate-from-captures route error", error);
    return NextResponse.json(
      { error: "Failed to generate vocabulary items" },
      { status: 500 }
    );
  }
}
