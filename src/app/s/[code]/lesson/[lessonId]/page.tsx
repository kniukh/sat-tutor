import { createClient } from "@/lib/supabase/server";
import LessonStagePanel from "@/components/student/LessonStagePanel";
import ReadingProgressTracker from "@/components/student/ReadingProgressTracker";
import { getPublishedLessonById } from "@/services/content/content.service";
import { getLessonSequenceByCurrentLessonId } from "@/services/reading/reading.service";
import { getOrCreateLessonState } from "@/services/lesson-state/lesson-state.service";
import { classifyReviewQueueCandidate } from "@/services/vocabulary/review-queue.service";
import Link from "next/link";
import { studentDashboardPath } from "@/lib/routes/student";

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

  const questions = (lesson.question_bank ?? []).sort(
    (a: { display_order: number }, b: { display_order: number }) =>
      a.display_order - b.display_order
  );

  const { data: vocabItems } = await supabase
    .from("vocabulary_item_details")
    .select("*")
    .eq("student_id", student.id)
    .eq("lesson_id", lesson.id)
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

  return (
    <div className="reading-stage-shell">
      <ReadingProgressTracker studentId={student.id} lessonId={lesson.id} />

      <div className="reading-topbar">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href={studentDashboardPath()}
            className="secondary-button min-h-10 px-3 py-2 text-xs sm:text-sm"
          >
            Back
          </Link>

          <div className="min-w-0 text-right">
            <div className="token-text-primary truncate text-sm font-semibold sm:text-base">
              {lesson.name}
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
          lessonName={lesson.name}
          nextLessonId={lessonSequence.nextLesson?.id ?? null}
          passageId={mainPassage?.id}
          passageText={mainPassage?.passage_text ?? ""}
          state={{ stage: lessonState.stage }}
          questions={(questions ?? []) as any}
          vocabItems={enrichedVocabItems as any}
        />
      </div>
    </div>
  );
}
