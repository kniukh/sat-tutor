import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { generateVocabularyItemsFromCaptures } from "@/services/vocabulary/drill-preparation.service";
import { aggregateVocabularyCaptureRows, type VocabularyCaptureEventRow } from "@/services/vocabulary/vocabulary-capture.service";
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";

type ExistingVocabularyItemRow = {
  id: string;
  item_text: string;
  item_type?: string | null;
  canonical_lemma?: string | null;
  captured_surface_forms?: string[] | null;
  capture_count?: number | null;
  first_captured_at?: string | null;
  last_captured_at?: string | null;
  english_explanation: string | null;
  translated_explanation: string | null;
  example_text: string | null;
  context_sentence: string | null;
  audio_status?: string | null;
  audio_url?: string | null;
};

type CaptureFallbackRow = VocabularyCaptureEventRow;

function normalizeKey(text: string) {
  return text.trim().toLowerCase();
}

function getExistingItemCanonicalKey(item: ExistingVocabularyItemRow) {
  if (item.canonical_lemma) {
    return normalizeKey(item.canonical_lemma);
  }

  return resolveVocabularyLemma({
    itemText: item.item_text,
    itemType: item.item_type,
  }).canonicalLemma;
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
    .select("id, item_text, item_type, canonical_lemma, captured_surface_forms, capture_count, first_captured_at, last_captured_at, english_explanation, translated_explanation, example_text, context_sentence, audio_status, audio_url")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("created_at", { ascending: true });

  if (existingError) {
    throw existingError;
  }

  const existingItems = ((existingRows ?? []) as ExistingVocabularyItemRow[])
    .filter((item) =>
      requestedKeys
        ? requestedKeys.has(normalizeKey(item.canonical_lemma ?? item.item_text)) ||
          requestedKeys.has(normalizeKey(item.item_text))
        : true
    )
    .slice(0, limit ?? Number.MAX_SAFE_INTEGER);
  const existingItemsByKey = new Map(
    existingItems.map((item) => [getExistingItemCanonicalKey(item), item])
  );

  const { data: captureRows, error: captureError } = await supabase
    .from("vocabulary_capture_events")
    .select("item_text, item_type, context_text, created_at, metadata, canonical_lemma, captured_surface_form")
    .eq("student_id", params.studentId)
    .eq("lesson_id", params.lessonId)
    .order("created_at", { ascending: true });

  if (captureError) {
    throw captureError;
  }

  const uniqueCaptures = aggregateVocabularyCaptureRows((captureRows ?? []) as CaptureFallbackRow[])
    .filter((item) =>
      requestedKeys ? item.lookupKeys.some((key) => requestedKeys.has(normalizeKey(key))) : true
    )
    .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

  const missingRows = uniqueCaptures
    .filter((item) => !existingItemsByKey.has(normalizeKey(item.canonicalLemma)))
    .map((item) => ({
      student_id: params.studentId,
      lesson_id: params.lessonId,
      item_text: item.itemText,
      item_type: item.itemType,
      canonical_lemma: item.canonicalLemma,
      captured_surface_forms: item.capturedSurfaceForms,
      capture_count: item.captureCount,
      first_captured_at: item.firstCapturedAt,
      last_captured_at: item.lastCapturedAt,
      english_explanation:
        item.preview?.plainEnglishMeaning?.trim() ||
        item.preview?.contextMeaning?.trim() ||
        `Meaning of "${item.itemText}" in this lesson.`,
      translated_explanation: item.preview?.translation?.trim() || null,
      example_text:
        item.contextText ??
        item.preview?.contextMeaning?.trim() ??
        null,
      context_sentence:
        item.contextText ??
        item.preview?.contextMeaning?.trim() ??
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
        .select("id, item_text, item_type, canonical_lemma, captured_surface_forms, capture_count, first_captured_at, last_captured_at, english_explanation, translated_explanation, example_text, context_sentence, audio_status, audio_url")
        .eq("student_id", params.studentId)
        .eq("lesson_id", params.lessonId)
        .order("created_at", { ascending: true });

      if (!refreshedError) {
        const refreshedItems = ((refreshedRows ?? []) as ExistingVocabularyItemRow[])
          .filter((item) =>
            requestedKeys
              ? requestedKeys.has(normalizeKey(item.canonical_lemma ?? item.item_text)) ||
                requestedKeys.has(normalizeKey(item.item_text))
              : true
          )
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
    id: `degraded:${params.lessonId}:${index}:${normalizeKey(item.canonicalLemma)}`,
    item_type: item.itemType,
    item_text: item.itemText,
    canonical_lemma: item.canonicalLemma,
    captured_surface_forms: item.capturedSurfaceForms,
    capture_count: item.captureCount,
    first_captured_at: item.firstCapturedAt,
    last_captured_at: item.lastCapturedAt,
    english_explanation:
      item.preview?.plainEnglishMeaning?.trim() ||
      item.preview?.contextMeaning?.trim() ||
      `Meaning of "${item.itemText}" in this lesson.`,
    translated_explanation: item.preview?.translation?.trim() || null,
    example_text:
      item.contextText ??
      item.preview?.contextMeaning?.trim() ??
      null,
    context_sentence:
      item.contextText ??
      item.preview?.contextMeaning?.trim() ??
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
