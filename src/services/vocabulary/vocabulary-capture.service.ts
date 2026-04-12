import { createClient } from "@/lib/supabase/server";
import {
  mergeVocabularySurfaceForms,
  normalizeCapturedSurfaceForm,
  resolveVocabularyLemma,
  type VocabularyItemType,
} from "@/services/vocabulary/vocabulary-normalization.service";

type CapturePreview = {
  plainEnglishMeaning?: string | null;
  translation?: string | null;
  contextMeaning?: string | null;
} | null;

export type VocabularyCaptureInput = {
  itemText: string;
  itemType?: string | null;
  sourceType?: "passage" | "question" | "answer" | "vocab_drill" | null;
  contextText?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type VocabularyCaptureEventRow = {
  id?: string;
  student_id?: string;
  lesson_id?: string | null;
  passage_id?: string | null;
  item_text: string;
  item_type: string | null;
  context_text: string | null;
  source_type?: string | null;
  metadata?: {
    preview?: CapturePreview;
  } | Record<string, unknown> | null;
  created_at: string | null;
  canonical_lemma?: string | null;
  captured_surface_form?: string | null;
};

export type AggregatedVocabularyCapture = {
  itemText: string;
  itemType: VocabularyItemType;
  canonicalLemma: string;
  captureCount: number;
  capturedSurfaceForms: string[];
  firstCapturedAt: string | null;
  lastCapturedAt: string | null;
  contextText: string | null;
  preview: CapturePreview;
  lookupKeys: string[];
};

type RecordVocabularyCapturesResult = {
  insertedEvents: VocabularyCaptureEventRow[];
  aggregates: AggregatedVocabularyCapture[];
};

function getNextReviewDate(daysToAdd: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function normalizeSourceType(sourceType: string | null | undefined) {
  if (sourceType === "question" || sourceType === "answer" || sourceType === "vocab_drill") {
    return sourceType;
  }

  return "passage";
}

function parseCapturePreview(metadata: VocabularyCaptureEventRow["metadata"]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const preview =
    "preview" in metadata && metadata.preview && typeof metadata.preview === "object"
      ? metadata.preview
      : null;

  if (!preview || Array.isArray(preview)) {
    return null;
  }

  const previewRecord = preview as Record<string, unknown>;

  return {
    plainEnglishMeaning:
      typeof previewRecord.plainEnglishMeaning === "string"
        ? previewRecord.plainEnglishMeaning
        : null,
    translation:
      typeof previewRecord.translation === "string" ? previewRecord.translation : null,
    contextMeaning:
      typeof previewRecord.contextMeaning === "string"
        ? previewRecord.contextMeaning
        : null,
  } satisfies NonNullable<CapturePreview>;
}

export function aggregateVocabularyCaptureRows(
  rows: VocabularyCaptureEventRow[]
): AggregatedVocabularyCapture[] {
  const aggregates = new Map<string, AggregatedVocabularyCapture>();

  for (const row of rows) {
    const resolved = resolveVocabularyLemma({
      itemText:
        row.captured_surface_form?.trim() ||
        row.item_text?.trim() ||
        "",
      itemType: row.item_type,
    });

    if (!resolved.normalizedSurfaceForm || !resolved.canonicalLemma) {
      continue;
    }

    const key = `${resolved.itemType}:${resolved.canonicalLemma}`;
    const preview = parseCapturePreview(row.metadata);
    const existing = aggregates.get(key);
    const createdAt = row.created_at ?? null;
    const contextText = row.context_text?.trim() || null;
    const representativeText = row.item_text?.trim() || resolved.normalizedSurfaceForm;

    if (!existing) {
      aggregates.set(key, {
        itemText: representativeText,
        itemType: resolved.itemType,
        canonicalLemma: resolved.canonicalLemma,
        captureCount: 1,
        capturedSurfaceForms: mergeVocabularySurfaceForms([], [
          row.captured_surface_form ?? representativeText,
        ]),
        firstCapturedAt: createdAt,
        lastCapturedAt: createdAt,
        contextText,
        preview,
        lookupKeys: Array.from(
          new Set([
            representativeText.trim().toLowerCase(),
            resolved.normalizedSurfaceForm,
            resolved.canonicalLemma,
          ])
        ),
      });
      continue;
    }

    existing.captureCount += 1;
    existing.capturedSurfaceForms = mergeVocabularySurfaceForms(existing.capturedSurfaceForms, [
      row.captured_surface_form ?? representativeText,
    ]);
    existing.lookupKeys = Array.from(
      new Set([
        ...existing.lookupKeys,
        representativeText.trim().toLowerCase(),
        resolved.normalizedSurfaceForm,
        resolved.canonicalLemma,
      ])
    );

    if (!existing.firstCapturedAt || (createdAt && createdAt < existing.firstCapturedAt)) {
      existing.firstCapturedAt = createdAt;
    }

    if (!existing.lastCapturedAt || (createdAt && createdAt > existing.lastCapturedAt)) {
      existing.lastCapturedAt = createdAt;
      if (contextText) {
        existing.contextText = contextText;
      }
      if (preview) {
        existing.preview = preview;
      }
    }
  }

  return Array.from(aggregates.values());
}

async function syncWordProgressCaptureStats(params: {
  studentId: string;
  lessonId?: string | null;
  aggregates: AggregatedVocabularyCapture[];
}) {
  if (params.aggregates.length === 0) {
    return;
  }

  const supabase = await createClient();
  const canonicalLemmas = Array.from(
    new Set(params.aggregates.map((item) => item.canonicalLemma))
  );
  const legacyWordKeys = Array.from(
    new Set(
      params.aggregates.flatMap((item) => [
        item.itemText.trim().toLowerCase(),
        ...item.lookupKeys,
      ])
    )
  );

  const [canonicalRowsResult, legacyRowsResult] = await Promise.all([
    supabase
      .from("word_progress")
      .select("*")
      .eq("student_id", params.studentId)
      .in("canonical_lemma", canonicalLemmas),
    supabase
      .from("word_progress")
      .select("*")
      .eq("student_id", params.studentId)
      .in("word", legacyWordKeys),
  ]);

  if (canonicalRowsResult.error) {
    throw canonicalRowsResult.error;
  }

  if (legacyRowsResult.error) {
    throw legacyRowsResult.error;
  }

  const existingRows = new Map<string, any>();

  for (const row of [...(canonicalRowsResult.data ?? []), ...(legacyRowsResult.data ?? [])]) {
    const resolved = resolveVocabularyLemma({
      itemText: typeof row.word === "string" ? row.word : "",
      itemType: typeof row.item_type === "string" ? row.item_type : null,
    });
    const canonicalLemma =
      (typeof row.canonical_lemma === "string" && row.canonical_lemma.trim().toLowerCase()) ||
      resolved.canonicalLemma;

    if (!canonicalLemma) {
      continue;
    }

    const key = `${row.item_type === "phrase" ? "phrase" : "word"}:${canonicalLemma}`;
    if (!existingRows.has(key)) {
      existingRows.set(key, row);
      continue;
    }

    const existing = existingRows.get(key);
    const existingCaptureCount = Number(existing?.capture_count ?? 0);
    const nextCaptureCount = Number(row?.capture_count ?? 0);

    if (nextCaptureCount > existingCaptureCount) {
      existingRows.set(key, row);
    }
  }

  for (const aggregate of params.aggregates) {
    const key = `${aggregate.itemType}:${aggregate.canonicalLemma}`;
    const existing = existingRows.get(key) ?? null;
    const nextCapturedSurfaceForms = mergeVocabularySurfaceForms(
      existing?.captured_surface_forms ?? [],
      aggregate.capturedSurfaceForms
    );

    if (!existing) {
      const { error: insertError } = await supabase.from("word_progress").insert({
        student_id: params.studentId,
        word: aggregate.itemText,
        item_type: aggregate.itemType,
        canonical_lemma: aggregate.canonicalLemma,
        captured_surface_forms: nextCapturedSurfaceForms,
        capture_count: aggregate.captureCount,
        first_captured_at: aggregate.firstCapturedAt,
        last_captured_at: aggregate.lastCapturedAt,
        status: "learning",
        lifecycle_state: "new",
        times_seen: 1,
        times_correct: 0,
        times_wrong: 1,
        next_review_date: getNextReviewDate(1),
        total_attempts: 0,
        correct_attempts: 0,
        sessions_seen_count: 0,
        sessions_correct_count: 0,
        mastery_score: 0,
        source_lesson_id: params.lessonId ?? null,
        metadata: {
          repetition_engine: "session_based_v1",
          capture_normalized: true,
        },
      });

      if (insertError) {
        throw insertError;
      }

      continue;
    }

    const currentCaptureCount = Number(existing.capture_count ?? 0);
    const currentFirstCapturedAt =
      typeof existing.first_captured_at === "string" ? existing.first_captured_at : null;
    const currentLastCapturedAt =
      typeof existing.last_captured_at === "string" ? existing.last_captured_at : null;
    const nextFirstCapturedAt =
      currentFirstCapturedAt && aggregate.firstCapturedAt
        ? currentFirstCapturedAt < aggregate.firstCapturedAt
          ? currentFirstCapturedAt
          : aggregate.firstCapturedAt
        : currentFirstCapturedAt ?? aggregate.firstCapturedAt ?? null;
    const nextLastCapturedAt =
      currentLastCapturedAt && aggregate.lastCapturedAt
        ? currentLastCapturedAt > aggregate.lastCapturedAt
          ? currentLastCapturedAt
          : aggregate.lastCapturedAt
        : currentLastCapturedAt ?? aggregate.lastCapturedAt ?? null;

    const { error: updateError } = await supabase
      .from("word_progress")
      .update({
        canonical_lemma: aggregate.canonicalLemma,
        captured_surface_forms: nextCapturedSurfaceForms,
        capture_count: currentCaptureCount + aggregate.captureCount,
        first_captured_at: nextFirstCapturedAt,
        last_captured_at: nextLastCapturedAt,
        status: existing.status === "mastered" ? "review" : existing.status ?? "learning",
        next_review_date: getNextReviewDate(1),
        source_lesson_id: params.lessonId ?? existing.source_lesson_id ?? null,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
          capture_normalized: true,
        },
      })
      .eq("id", existing.id);

    if (updateError) {
      throw updateError;
    }
  }
}

export async function recordVocabularyCaptures(params: {
  studentId: string;
  lessonId?: string | null;
  passageId?: string | null;
  items: VocabularyCaptureInput[];
  updateWordProgress?: boolean;
}): Promise<RecordVocabularyCapturesResult> {
  const supabase = await createClient();
  const normalizedItems = params.items
    .map((item) => {
      const resolved = resolveVocabularyLemma({
        itemText: item.itemText,
        itemType: item.itemType,
      });

      if (!resolved.normalizedSurfaceForm || !resolved.canonicalLemma) {
        return null;
      }

      const metadata =
        item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? item.metadata
          : {};

      return {
        student_id: params.studentId,
        lesson_id: params.lessonId ?? null,
        passage_id: params.passageId ?? null,
        item_text: resolved.normalizedSurfaceForm,
        item_type: resolved.itemType,
        context_text: item.contextText?.trim() || null,
        source_type: normalizeSourceType(item.sourceType),
        metadata,
        canonical_lemma: resolved.canonicalLemma,
        captured_surface_form:
          normalizeCapturedSurfaceForm(item.itemText) || resolved.normalizedSurfaceForm,
      };
    })
    .filter(Boolean) as Array<{
      student_id: string;
      lesson_id: string | null;
      passage_id: string | null;
      item_text: string;
      item_type: VocabularyItemType;
      context_text: string | null;
      source_type: string;
      metadata: Record<string, unknown>;
      canonical_lemma: string;
      captured_surface_form: string;
    }>;

  if (normalizedItems.length === 0) {
    return {
      insertedEvents: [],
      aggregates: [],
    };
  }

  const { data, error } = await supabase
    .from("vocabulary_capture_events")
    .insert(normalizedItems)
    .select("*");

  if (error) {
    throw error;
  }

  const insertedEvents = (data ?? []) as VocabularyCaptureEventRow[];
  const aggregates = aggregateVocabularyCaptureRows(insertedEvents);

  if (params.updateWordProgress !== false) {
    await syncWordProgressCaptureStats({
      studentId: params.studentId,
      lessonId: params.lessonId ?? null,
      aggregates,
    });
  }

  return {
    insertedEvents,
    aggregates,
  };
}
