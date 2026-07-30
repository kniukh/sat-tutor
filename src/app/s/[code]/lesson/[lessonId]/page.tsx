import { createClient } from "@/lib/supabase/server";
import LessonStagePanel from "@/components/student/LessonStagePanel";
import ReadingProgressTracker from "@/components/student/ReadingProgressTracker";
import { getPublishedLessonById } from "@/services/content/content.service";
import { getLessonSequenceByCurrentLessonId } from "@/services/reading/reading.service";
import { getOrCreateLessonState } from "@/services/lesson-state/lesson-state.service";
import { classifyReviewQueueCandidate } from "@/services/vocabulary/review-queue.service";
import Link from "next/link";
import { studentDashboardPath } from "@/lib/routes/student";
import type { PassageAudioSentenceTiming } from "@/components/student/PassageAudioControls";
import ReadingCoachBrand from "@/components/student/ReadingCoachBrand";

function parsePassageAudioSentenceTimings(value: unknown): PassageAudioSentenceTiming[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): PassageAudioSentenceTiming | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const sentenceText = String(row.sentenceText ?? row.sentence_text ?? "").trim();
      if (!sentenceText) {
        return null;
      }

      return {
        sentenceIndex:
          typeof row.sentenceIndex === "number"
            ? row.sentenceIndex
            : typeof row.sentence_index === "number"
              ? row.sentence_index
              : null,
        sentenceText,
        audioStartMs:
          typeof row.audioStartMs === "number"
            ? row.audioStartMs
            : typeof row.audio_start_ms === "number"
              ? row.audio_start_ms
              : null,
        audioEndMs:
          typeof row.audioEndMs === "number"
            ? row.audioEndMs
            : typeof row.audio_end_ms === "number"
              ? row.audio_end_ms
              : null,
        confidence:
          typeof row.confidence === "number"
            ? row.confidence
            : null,
      };
    })
    .filter(Boolean) as PassageAudioSentenceTiming[];
}

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ code: string; lessonId: string }>;
}) {
  const { code, lessonId } = await params;

  const supabase = await createClient();

  const lesson = await getPublishedLessonById(lessonId);
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*")
    .eq("access_code", code)
    .eq("is_active", true)
    .single();

  if (studentError || !student) {
    throw new Error("Student not found");
  }

  const lessonState = await getOrCreateLessonState(student.id, lesson.id);

  const lessonSequence = await getLessonSequenceByCurrentLessonId(lesson.id);

  const passages = (lesson.lesson_passages ?? []).sort(
    (a: { display_order: number }, b: { display_order: number }) =>
      a.display_order - b.display_order
  );

  const mainPassage = passages[0] ?? null;
  const passageAudioSentenceTimings = parsePassageAudioSentenceTimings(
    mainPassage?.audio_sentence_timings
  );

  const questions = (lesson.question_bank ?? []).sort(
    (a: { display_order: number }, b: { display_order: number }) =>
      a.display_order - b.display_order
  );

  const { data: vocabItems } = await supabase
    .from("vocabulary_item_details")
    .select("*")
    .eq("student_id", student.id)
    .eq("lesson_id", lesson.id)
    .eq("is_removed", false)
    .order("created_at", { ascending: true });

  const vocabItemIds = (vocabItems ?? []).map((item: any) => item.id).filter(Boolean);
  const [{ data: wordProgressRows }, { data: reviewQueueRows }] = await Promise.all([
    vocabItemIds.length > 0
      ? supabase
          .from("word_progress")
          .select("word_id, lifecycle_state, next_review_at")
          .eq("student_id", student.id)
          .in("word_id", vocabItemIds)
      : Promise.resolve({ data: [] as any[] }),
    vocabItemIds.length > 0
      ? supabase
          .from("review_queue")
          .select("word_id, reason, lifecycle_state, scheduled_for, status, created_at")
          .eq("student_id", student.id)
          .in("word_id", vocabItemIds)
          .in("status", ["pending", "scheduled"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const wordProgressMap = new Map(
    (wordProgressRows ?? []).map((row: any) => [row.word_id, row])
  );
  const reviewQueueMap = new Map<string, any>();

  for (const row of reviewQueueRows ?? []) {
    if (!row?.word_id || reviewQueueMap.has(row.word_id)) {
      continue;
    }

    reviewQueueMap.set(row.word_id, row);
  }

  const enrichedVocabItems = (vocabItems ?? []).map((item: any) => {
    const wordProgress = wordProgressMap.get(item.id) ?? null;
    const reviewQueue = reviewQueueMap.get(item.id) ?? null;
    const reviewBucket = reviewQueue
      ? classifyReviewQueueCandidate(reviewQueue, new Date())
      : null;

    return {
      ...item,
      lifecycle_state: wordProgress?.lifecycle_state ?? null,
      review_bucket: reviewBucket,
      review_ready:
        reviewBucket === "recently_failed" ||
        reviewBucket === "weak_again" ||
        reviewBucket === "overdue",
    };
  });
  const displayLessonName = lesson.name.replace(
    /^(Chapter\s+\d+)\s*[—:-]\s*\1\s*[—:-]\s*/i,
    "$1 — "
  );

  return (
    <div className="reading-stage-shell">
      <ReadingProgressTracker studentId={student.id} lessonId={lesson.id} />

      <div className="reading-topbar">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Link href={studentDashboardPath()} className="coach-back-button !h-11 !w-11">←</Link>
            <ReadingCoachBrand compact />
          </div>

          <div className="min-w-0 text-right">
            <div className="token-text-primary truncate text-sm font-semibold sm:text-base">
              {displayLessonName}
            </div>
            <div className="token-text-muted text-[11px] uppercase tracking-[0.16em]">
              Reading
            </div>
          </div>
        </div>
      </div>

      <div className="pb-6">
        <LessonStagePanel
          accessCode={code}
          studentId={student.id}
          lessonId={lesson.id}
          lessonName={displayLessonName}
          nextLessonId={lessonSequence.nextLesson?.id ?? null}
          passageId={mainPassage?.id}
          passageText={mainPassage?.passage_text ?? ""}
          passageAudioUrl={mainPassage?.audio_url ?? null}
          passageAudioStartMs={mainPassage?.audio_start_ms ?? null}
          passageAudioEndMs={mainPassage?.audio_end_ms ?? null}
          passageAudioSentenceTimings={passageAudioSentenceTimings}
          passageAudioAlignmentConfidence={mainPassage?.audio_alignment_confidence ?? null}
          state={{ stage: lessonState.stage }}
          questions={(questions ?? []) as any}
          vocabItems={enrichedVocabItems as any}
        />
      </div>
    </div>
  );
}
