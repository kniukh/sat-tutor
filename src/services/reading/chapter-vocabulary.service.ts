import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";

export const CORE_WORDS_PER_CHUNK = 8;

type ChapterVocabularyCandidate = {
  id: string;
  lesson_id: string | null;
  item_text: string;
  item_type: string | null;
  canonical_lemma: string | null;
  capture_count: number | null;
  created_at: string | null;
};

export type ChapterVocabularyPlanRow = {
  id: string;
  assignment_id: string;
  student_id: string;
  vocabulary_item_id: string;
  lesson_id: string | null;
  canonical_lemma: string;
  word: string;
  source_chunk_index: number | null;
  selection_score: number;
  is_core: boolean;
  introduced_at: string | null;
  introduced_session_id: string | null;
};

export type ChapterVocabularyProgress = {
  requiredCount: number;
  introducedCount: number;
  pendingCount: number;
  pendingWordIds: string[];
  rows: ChapterVocabularyPlanRow[];
};

function normalizeWordKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getCanonicalLemma(candidate: Pick<ChapterVocabularyCandidate, "item_text" | "item_type" | "canonical_lemma">) {
  return (
    normalizeWordKey(candidate.canonical_lemma) ||
    resolveVocabularyLemma({
      itemText: candidate.item_text,
      itemType: candidate.item_type === "phrase" ? "phrase" : "word",
    }).canonicalLemma
  );
}

function getCandidateScore(candidate: ChapterVocabularyCandidate) {
  const captureCount = Number(candidate.capture_count ?? 0);
  const wordBonus = candidate.item_type === "word" ? 0.2 : 0;
  return captureCount + wordBonus;
}

async function listPlanRows(params: { studentId: string; assignmentId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reading_assignment_vocabulary")
    .select(
      "id, assignment_id, student_id, vocabulary_item_id, lesson_id, canonical_lemma, word, source_chunk_index, selection_score, is_core, introduced_at, introduced_session_id"
    )
    .eq("student_id", params.studentId)
    .eq("assignment_id", params.assignmentId)
    .eq("is_core", true)
    .order("source_chunk_index", { ascending: true, nullsFirst: false })
    .order("selection_score", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChapterVocabularyPlanRow[];
}

export async function ensureChapterVocabularyPlan(params: {
  studentId: string;
  assignmentId: string;
  completedLessons: Array<{ lessonId: string; chunkIndex: number | null }>;
}) {
  const supabase = await createServerSupabaseClient();
  const existingRows = await listPlanRows(params);
  const existingKeys = new Set(existingRows.map((row) => normalizeWordKey(row.canonical_lemma)));
  const completedLessons = params.completedLessons.filter((lesson) => Boolean(lesson.lessonId));

  if (completedLessons.length > 0) {
    const lessonIds = completedLessons.map((lesson) => lesson.lessonId);
    const [{ data: details, error: detailsError }, { data: progress, error: progressError }] =
      await Promise.all([
        supabase
          .from("vocabulary_item_details")
          .select("id, lesson_id, item_text, item_type, canonical_lemma, capture_count, created_at")
          .eq("student_id", params.studentId)
          .eq("is_removed", false)
          .in("lesson_id", lessonIds),
        supabase
          .from("word_progress")
          .select("word_id, canonical_lemma, total_attempts, times_seen")
          .eq("student_id", params.studentId),
      ]);

    if (detailsError) throw detailsError;
    if (progressError) throw progressError;

    const progressByWordId = new Map(
      (progress ?? [])
        .filter((row) => Boolean(row.word_id))
        .map((row) => [row.word_id as string, row])
    );
    const progressByLemma = new Map(
      (progress ?? [])
        .filter((row) => typeof row.canonical_lemma === "string")
        .map((row) => [normalizeWordKey(row.canonical_lemma), row])
    );
    const plannedLessons = new Set(
      existingRows.map((row) => row.lesson_id).filter((lessonId): lessonId is string => Boolean(lessonId))
    );
    const rowsToInsert: Array<Record<string, unknown>> = [];

    for (const lesson of completedLessons) {
      if (plannedLessons.has(lesson.lessonId)) continue;

      const lessonCandidates = new Map<string, ChapterVocabularyCandidate>();
      for (const detail of (details ?? []) as ChapterVocabularyCandidate[]) {
        if (detail.lesson_id !== lesson.lessonId || !detail.item_text?.trim()) continue;

        const canonicalLemma = getCanonicalLemma(detail);
        if (!canonicalLemma || existingKeys.has(canonicalLemma)) continue;

        const previousProgress =
          progressByWordId.get(detail.id) ?? progressByLemma.get(canonicalLemma);
        const hasPriorExposure =
          Number(previousProgress?.total_attempts ?? 0) > 0 ||
          Number(previousProgress?.times_seen ?? 0) > 1;
        if (hasPriorExposure) continue;

        const current = lessonCandidates.get(canonicalLemma);
        if (!current || getCandidateScore(detail) > getCandidateScore(current)) {
          lessonCandidates.set(canonicalLemma, detail);
        }
      }

      const selectedCandidates = Array.from(lessonCandidates.values())
        .sort((a, b) => {
          const scoreDiff = getCandidateScore(b) - getCandidateScore(a);
          if (scoreDiff !== 0) return scoreDiff;
          return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
        })
        .slice(0, CORE_WORDS_PER_CHUNK);

      for (const candidate of selectedCandidates) {
        const canonicalLemma = getCanonicalLemma(candidate);
        if (!canonicalLemma || existingKeys.has(canonicalLemma)) continue;

        existingKeys.add(canonicalLemma);
        rowsToInsert.push({
          assignment_id: params.assignmentId,
          student_id: params.studentId,
          vocabulary_item_id: candidate.id,
          lesson_id: candidate.lesson_id,
          canonical_lemma: canonicalLemma,
          word: candidate.item_text.trim(),
          source_chunk_index: lesson.chunkIndex,
          selection_score: getCandidateScore(candidate),
          is_core: true,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("reading_assignment_vocabulary")
        .upsert(rowsToInsert, { onConflict: "assignment_id,canonical_lemma", ignoreDuplicates: true });
      if (insertError) throw insertError;
    }
  }

  return listPlanRows(params);
}

export async function getChapterVocabularyProgress(params: {
  studentId: string;
  assignmentId: string;
  completedLessons?: Array<{ lessonId: string; chunkIndex: number | null }>;
}): Promise<ChapterVocabularyProgress> {
  let rows = params.completedLessons
    ? await ensureChapterVocabularyPlan({
        studentId: params.studentId,
        assignmentId: params.assignmentId,
        completedLessons: params.completedLessons,
      })
    : await listPlanRows(params);
  const pendingWordIds = rows
    .filter((row) => !row.introduced_at)
    .map((row) => row.vocabulary_item_id);

  if (pendingWordIds.length > 0) {
    const supabase = await createServerSupabaseClient();
    const { data: progress, error } = await supabase
      .from("word_progress")
      .select("word_id, total_attempts")
      .eq("student_id", params.studentId)
      .in("word_id", pendingWordIds);
    if (error) throw error;

    const introducedWordIds = (progress ?? [])
      .filter((row) => Number(row.total_attempts ?? 0) > 0)
      .map((row) => row.word_id)
      .filter((wordId): wordId is string => Boolean(wordId));

    if (introducedWordIds.length > 0) {
      const { error: updateError } = await supabase
        .from("reading_assignment_vocabulary")
        .update({
          introduced_at: new Date().toISOString(),
        })
        .eq("student_id", params.studentId)
        .eq("assignment_id", params.assignmentId)
        .is("introduced_at", null)
        .in("vocabulary_item_id", introducedWordIds);
      if (updateError) throw updateError;
      rows = await listPlanRows(params);
    }
  }

  const introducedRows = rows.filter((row) => Boolean(row.introduced_at));
  const pendingRows = rows.filter((row) => !row.introduced_at);

  return {
    requiredCount: rows.length,
    introducedCount: introducedRows.length,
    pendingCount: pendingRows.length,
    pendingWordIds: pendingRows.map((row) => row.vocabulary_item_id),
    rows,
  };
}

export async function markChapterVocabularyWordIntroduced(params: {
  studentId: string;
  assignmentId: string;
  vocabularyItemId?: string | null;
  word?: string | null;
  sessionId?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("reading_assignment_vocabulary")
    .update({
      introduced_at: now,
      introduced_session_id: params.sessionId ?? null,
      updated_at: now,
    })
    .eq("student_id", params.studentId)
    .eq("assignment_id", params.assignmentId)
    .eq("is_core", true)
    .is("introduced_at", null);

  if (params.vocabularyItemId) {
    query = query.eq("vocabulary_item_id", params.vocabularyItemId);
  } else {
    const canonicalLemma = params.word?.trim()
      ? resolveVocabularyLemma({
          itemText: params.word,
          itemType: params.word.includes(" ") ? "phrase" : "word",
        }).canonicalLemma
      : "";
    if (!canonicalLemma) return;
    query = query.eq("canonical_lemma", canonicalLemma);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function refreshChapterVocabularyCheckpoint(params: {
  studentId: string;
  assignmentId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const progress = await getChapterVocabularyProgress(params);
  const { error } = await supabase
    .from("reading_assignments")
    .update({
      vocabulary_checkpoints_completed: progress.introducedCount,
    })
    .eq("id", params.assignmentId)
    .eq("student_id", params.studentId);

  if (error) throw error;
  return progress;
}
