import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ExerciseAttemptRow,
  ReviewQueueRow,
  VocabModality,
  WordProgressRow,
} from "@/types/vocab-tracking";
import { getCurrentVocabularySessionIndex } from "@/services/vocabulary/vocab-session.service";

type QueueWordProgress = Pick<
  WordProgressRow,
  | "id"
  | "student_id"
  | "word"
  | "word_id"
  | "lifecycle_state"
  | "mastery_score"
  | "metadata"
  | "consecutive_incorrect"
  | "next_review_session_index"
  | "next_review_session_gap"
  | "next_review_at"
  | "minimum_time_gap_for_retention_check"
  | "last_seen_at"
  | "last_modality"
>;

export type GeneratedReviewQueueItem = {
  student_id: string;
  word_id: string;
  priority_score: number;
  scheduled_for: string;
  reason: string;
  recommended_modality: VocabModality | null;
  source_attempt_id: string | null;
  status: ReviewQueueRow["status"];
  metadata: ReviewQueueRow["metadata"];
};

export type ReviewQueueCandidate = ReviewQueueRow & {
  word: string | null;
  lifecycle_state: WordProgressRow["lifecycle_state"] | null;
  mastery_score: number | null;
  last_modality: VocabModality | null;
};

export type ReviewQueuePriorityBucket =
  | "recently_failed"
  | "weak_again"
  | "overdue"
  | "reinforcement"
  | "scheduled";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hoursBetween(earlier: Date, later: Date) {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60);
}

function getRecentIncorrectAttempt(recentAttempts: ExerciseAttemptRow[], now: Date) {
  return (
    recentAttempts.find((attempt) => {
      if (attempt.is_correct) {
        return false;
      }

      const createdAt = new Date(attempt.created_at);
      return hoursBetween(createdAt, now) <= 48;
    }) ?? null
  );
}

function isWeakAgainReason(reason: string) {
  return reason === "weak_again_recovery" || reason === "mastery_relapse";
}

function isLearningReason(reason: string) {
  return (
    reason === "learning_reinforcement" ||
    reason === "learning_progression" ||
    reason === "first_exposure_followup"
  );
}

function getRecommendedModality(params: {
  wordProgress: QueueWordProgress;
  recentAttempts: ExerciseAttemptRow[];
  latestIncorrectAttempt: ExerciseAttemptRow | null;
}) {
  if (params.latestIncorrectAttempt?.modality === "text") {
    return "context" as const;
  }

  if (params.latestIncorrectAttempt?.modality === "context") {
    return "text" as const;
  }

  if (params.wordProgress.lifecycle_state === "weak_again") {
    return "mixed" as const;
  }

  if (
    params.wordProgress.lifecycle_state === "learning" &&
    params.wordProgress.last_modality === "text" &&
    Number(params.wordProgress.mastery_score ?? 0) < 0.5
  ) {
    return "context" as const;
  }

  return (
    params.wordProgress.last_modality ??
    params.recentAttempts[0]?.modality ??
    "text"
  );
}

export function buildReviewQueueItem(params: {
  wordProgress: QueueWordProgress;
  recentAttempts: ExerciseAttemptRow[];
  sourceAttemptId?: string | null;
  currentSessionIndex?: number | null;
  now?: Date;
}): GeneratedReviewQueueItem | null {
  const { wordProgress, recentAttempts } = params;
  const now = params.now ?? new Date();

  if (!wordProgress.word_id) {
    return null;
  }

  const nextReviewAt = wordProgress.next_review_at ? new Date(wordProgress.next_review_at) : null;
  const dueByTimeGap = nextReviewAt ? nextReviewAt.getTime() <= now.getTime() : false;
  const dueBySessionGap =
    typeof params.currentSessionIndex === "number" &&
    wordProgress.next_review_session_index !== null &&
    wordProgress.next_review_session_index !== undefined
      ? params.currentSessionIndex >= Number(wordProgress.next_review_session_index)
      : false;
  const isOverdue = dueByTimeGap || dueBySessionGap;
  const latestIncorrectAttempt = getRecentIncorrectAttempt(recentAttempts, now);
  const latestAttempt = recentAttempts[0] ?? null;
  const masteryScore = Number(wordProgress.mastery_score ?? 0);
  const sameSessionCreditCapped = Boolean(
    (wordProgress.metadata ?? {})["same_session_credit_capped"]
  );

  const shouldGenerate =
    Boolean(latestIncorrectAttempt) ||
    wordProgress.lifecycle_state === "weak_again" ||
    wordProgress.lifecycle_state === "learning" ||
    wordProgress.lifecycle_state === "new" ||
    wordProgress.lifecycle_state === "review" ||
    isOverdue ||
    Boolean(nextReviewAt);

  if (!shouldGenerate) {
    return null;
  }

  let basePriority = 0.35;
  let reason = "scheduled_review";

  if (latestIncorrectAttempt) {
    basePriority = 0.92;
    reason = "recent_incorrect_attempt";
  } else if (wordProgress.lifecycle_state === "weak_again") {
    basePriority = 0.98;
    reason = "weak_again_recovery";
  } else if (dueBySessionGap) {
    basePriority = 0.83;
    reason = "due_by_session_gap";
  } else if (dueByTimeGap) {
    basePriority = 0.78;
    reason = "due_by_time_gap";
  } else if (
    wordProgress.lifecycle_state === "learning" ||
    wordProgress.lifecycle_state === "new"
  ) {
    basePriority = 0.64;
    reason = "learning_reinforcement";
  } else if (wordProgress.lifecycle_state === "mastered") {
    basePriority = 0.22;
    reason = "mastery_maintenance";
  }

  let priorityScore = basePriority;
  priorityScore += Math.min(Number(wordProgress.consecutive_incorrect ?? 0) * 0.09, 0.24);

  if (masteryScore < 0.35) {
    priorityScore += 0.12;
  } else if (masteryScore < 0.6) {
    priorityScore += 0.06;
  }

  if (nextReviewAt && isOverdue) {
    const overdueHours = Math.max(0, hoursBetween(nextReviewAt, now));
    priorityScore += Math.min(overdueHours / 24 * 0.03, 0.15);
  }

  if (wordProgress.last_seen_at) {
    const lastSeenAt = new Date(wordProgress.last_seen_at);
    const hoursSinceSeen = Math.max(0, hoursBetween(lastSeenAt, now));

    if (
      hoursSinceSeen >= 72 &&
      (wordProgress.lifecycle_state === "learning" || wordProgress.lifecycle_state === "review")
    ) {
      priorityScore += 0.05;
    }
  }

  const scheduledAt =
    latestIncorrectAttempt || wordProgress.lifecycle_state === "weak_again" || isOverdue
      ? now
      : nextReviewAt ?? now;

  return {
    student_id: wordProgress.student_id,
    word_id: wordProgress.word_id,
    priority_score: Number(clamp(priorityScore, 0, 1).toFixed(4)),
    scheduled_for: scheduledAt.toISOString(),
    reason,
    recommended_modality: getRecommendedModality({
      wordProgress,
      recentAttempts,
      latestIncorrectAttempt,
    }),
    source_attempt_id: params.sourceAttemptId ?? latestIncorrectAttempt?.id ?? latestAttempt?.id ?? null,
    status: scheduledAt.getTime() <= now.getTime() ? "pending" : "scheduled",
    metadata: {
      due_by_session_gap: dueBySessionGap,
      due_by_time_gap: dueByTimeGap,
      overdue_review: isOverdue,
      weak_again_retry: wordProgress.lifecycle_state === "weak_again",
      same_session_credit_capped: sameSessionCreditCapped,
      next_review_session_gap: wordProgress.next_review_session_gap ?? null,
      next_review_session_index: wordProgress.next_review_session_index ?? null,
      current_session_index:
        typeof params.currentSessionIndex === "number" ? params.currentSessionIndex : null,
      minimum_time_gap_for_retention_check:
        wordProgress.minimum_time_gap_for_retention_check ?? null,
    },
  };
}

export function classifyReviewQueueCandidate(
  candidate: Pick<ReviewQueueCandidate, "reason" | "lifecycle_state" | "scheduled_for">,
  now: Date = new Date()
): ReviewQueuePriorityBucket {
  if (candidate.reason === "recent_incorrect_attempt") {
    return "recently_failed";
  }

  if (candidate.lifecycle_state === "weak_again" || isWeakAgainReason(candidate.reason)) {
    return "weak_again";
  }

  if (new Date(candidate.scheduled_for).getTime() <= now.getTime()) {
    return "overdue";
  }

  if (
    candidate.lifecycle_state === "new" ||
    candidate.lifecycle_state === "learning" ||
    candidate.lifecycle_state === "review" ||
    isLearningReason(candidate.reason)
  ) {
    return "reinforcement";
  }

  return "scheduled";
}

async function getRecentAttemptsForWord(params: {
  studentId: string;
  wordId: string;
  limit?: number;
}) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("exercise_attempts")
    .select("*")
    .eq("student_id", params.studentId)
    .eq("target_word_id", params.wordId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 5);

  if (error) {
    throw error;
  }

  return (data ?? []) as ExerciseAttemptRow[];
}

async function cancelExtraQueueItems(params: {
  studentId: string;
  wordId: string;
  keepId?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("review_queue")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", params.studentId)
    .eq("word_id", params.wordId)
    .in("status", ["pending", "scheduled"]);

  if (params.keepId) {
    query = query.neq("id", params.keepId);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

export async function syncReviewQueueForWordProgress(params: {
  studentId: string;
  wordProgressId: string;
  sourceAttemptId?: string | null;
  currentSessionIndex?: number | null;
  now?: Date;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: wordProgress, error: wordProgressError } = await supabase
    .from("word_progress")
    .select(
      "id, student_id, word, word_id, lifecycle_state, mastery_score, metadata, consecutive_incorrect, next_review_session_index, next_review_session_gap, next_review_at, minimum_time_gap_for_retention_check, last_seen_at, last_modality"
    )
    .eq("id", params.wordProgressId)
    .eq("student_id", params.studentId)
    .single<QueueWordProgress>();

  if (wordProgressError) {
    throw wordProgressError;
  }

  if (!wordProgress.word_id) {
    return null;
  }

  const recentAttempts = await getRecentAttemptsForWord({
    studentId: params.studentId,
    wordId: wordProgress.word_id,
  });

  const generated = buildReviewQueueItem({
    wordProgress,
    recentAttempts,
    sourceAttemptId: params.sourceAttemptId,
    currentSessionIndex: params.currentSessionIndex,
    now: params.now,
  });

  const { data: existingRows, error: existingError } = await supabase
    .from("review_queue")
    .select("*")
    .eq("student_id", params.studentId)
    .eq("word_id", wordProgress.word_id)
    .in("status", ["pending", "scheduled"])
    .order("created_at", { ascending: true });

  if (existingError) {
    throw existingError;
  }

  if (!generated) {
    await cancelExtraQueueItems({
      studentId: params.studentId,
      wordId: wordProgress.word_id,
    });

    return null;
  }

  const existing = (existingRows ?? []) as ReviewQueueRow[];
  const primaryExisting = existing[0] ?? null;

  if (primaryExisting) {
    const { data, error } = await supabase
      .from("review_queue")
      .update({
        priority_score: generated.priority_score,
        scheduled_for: generated.scheduled_for,
        reason: generated.reason,
        recommended_modality: generated.recommended_modality,
        source_attempt_id: generated.source_attempt_id,
        status: generated.status,
        metadata: generated.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", primaryExisting.id)
      .select()
      .single<ReviewQueueRow>();

    if (error) {
      throw error;
    }

    await cancelExtraQueueItems({
      studentId: params.studentId,
      wordId: wordProgress.word_id,
      keepId: primaryExisting.id,
    });

    return data;
  }

  const { data, error } = await supabase
    .from("review_queue")
    .insert(generated)
    .select()
    .single<ReviewQueueRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function generateReviewQueueForStudent(params: {
  studentId: string;
  limit?: number;
  now?: Date;
}) {
  const supabase = await createServerSupabaseClient();
  const now = params.now ?? new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 7);

  const { data: progressRows, error } = await supabase
    .from("word_progress")
    .select(
      "id, student_id, word, word_id, lifecycle_state, mastery_score, metadata, consecutive_incorrect, next_review_session_index, next_review_session_gap, next_review_at, minimum_time_gap_for_retention_check, last_seen_at, last_modality"
    )
    .eq("student_id", params.studentId)
    .not("word_id", "is", null)
    .order("next_review_at", { ascending: true })
    .limit(250);

  if (error) {
    throw error;
  }

  const candidateRows = ((progressRows ?? []) as QueueWordProgress[]).filter((row) => {
    if (["new", "learning", "review", "weak_again"].includes(row.lifecycle_state)) {
      return true;
    }

    if (!row.next_review_at) {
      return false;
    }

    return new Date(row.next_review_at).getTime() <= horizon.getTime();
  });

  const results: ReviewQueueRow[] = [];
  const currentSessionIndex = await getCurrentVocabularySessionIndex(params.studentId);

  for (const row of candidateRows.slice(0, params.limit ?? 100)) {
    const queueRow = await syncReviewQueueForWordProgress({
      studentId: params.studentId,
      wordProgressId: row.id,
      currentSessionIndex,
      now,
    });

    if (queueRow) {
      results.push(queueRow);
    }
  }

  return results;
}

async function enrichReviewQueueRows(params: {
  studentId: string;
  queueRows: ReviewQueueRow[];
}) {
  const supabase = await createServerSupabaseClient();

  if (params.queueRows.length === 0) {
    return [];
  }

  const wordIds = Array.from(new Set(params.queueRows.map((row) => row.word_id)));

  const { data: progressRows, error: progressError } = await supabase
    .from("word_progress")
    .select("word_id, word, lifecycle_state, mastery_score, last_modality")
    .eq("student_id", params.studentId)
    .in("word_id", wordIds);

  if (progressError) {
    throw progressError;
  }

  const progressMap = new Map(
    ((progressRows ?? []) as Array<
      Pick<WordProgressRow, "word_id" | "word" | "lifecycle_state" | "mastery_score" | "last_modality">
    >).map((row) => [row.word_id, row])
  );

  return params.queueRows.map((row) => {
    const progress = progressMap.get(row.word_id) ?? null;

    return {
      ...row,
      word: progress?.word ?? null,
      lifecycle_state: progress?.lifecycle_state ?? null,
      mastery_score: progress?.mastery_score ?? null,
      last_modality: progress?.last_modality ?? null,
    } satisfies ReviewQueueCandidate;
  });
}

export async function listActiveReviewQueueCandidates(params: {
  studentId: string;
  limit?: number;
}) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("review_queue")
    .select("*")
    .eq("student_id", params.studentId)
    .in("status", ["pending", "scheduled"])
    .order("priority_score", { ascending: false })
    .order("scheduled_for", { ascending: true })
    .limit(params.limit ?? 100);

  if (error) {
    throw error;
  }

  return enrichReviewQueueRows({
    studentId: params.studentId,
    queueRows: (data ?? []) as ReviewQueueRow[],
  });
}

export async function getNextReviewQueueCandidates(params: {
  studentId: string;
  limit?: number;
  dueOnly?: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  const limit = params.limit ?? 10;
  const nowIso = new Date().toISOString();

  const { data: dueRows, error: dueError } = await supabase
    .from("review_queue")
    .select("*")
    .eq("student_id", params.studentId)
    .in("status", ["pending", "scheduled"])
    .lte("scheduled_for", nowIso)
    .order("priority_score", { ascending: false })
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (dueError) {
    throw dueError;
  }

  let queueRows = (dueRows ?? []) as ReviewQueueRow[];

  if (!params.dueOnly && queueRows.length < limit) {
    const remaining = limit - queueRows.length;
    const usedIds = new Set(queueRows.map((row) => row.id));
    const { data: futureRows, error: futureError } = await supabase
      .from("review_queue")
      .select("*")
      .eq("student_id", params.studentId)
      .in("status", ["pending", "scheduled"])
      .gt("scheduled_for", nowIso)
      .order("priority_score", { ascending: false })
      .order("scheduled_for", { ascending: true })
      .limit(remaining + usedIds.size);

    if (futureError) {
      throw futureError;
    }

    queueRows = [
      ...queueRows,
      ...((futureRows ?? []) as ReviewQueueRow[]).filter((row) => !usedIds.has(row.id)).slice(0, remaining),
    ];
  }

  if (queueRows.length === 0) {
    return [];
  }

  return enrichReviewQueueRows({
    studentId: params.studentId,
    queueRows,
  });
}
