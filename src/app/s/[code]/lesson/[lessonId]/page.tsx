import { createClient } from "@/lib/supabase/server";
import LessonStagePanel from "@/components/student/LessonStagePanel";
import ReadingProgressTracker from "@/components/student/ReadingProgressTracker";
import { getPublishedLessonById } from "@/services/content/content.service";
import { getLessonSequenceByCurrentLessonId } from "@/services/reading/reading.service";
import { getOrCreateLessonState } from "@/services/lesson-state/lesson-state.service";
import ResetLessonButton from "@/components/student/ResetLessonButton";
import RegenerateAudioButton from "@/components/student/RegenerateAudioButton";
import Link from "next/link";

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

  await getLessonSequenceByCurrentLessonId(lesson.id);

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

  return (
    <div className="px-3 py-4 sm:px-6 sm:py-8">
      <ReadingProgressTracker studentId={student.id} lessonId={lesson.id} />

      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{lesson.name}</h1>
            <p className="mt-1 text-sm text-slate-600 sm:mt-2">
              {lesson.lesson_type} · {lessonState.stage.replace("_", " ")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <RegenerateAudioButton
              studentId={student.id}
              lessonId={lesson.id}
            />
            <ResetLessonButton
              studentId={student.id}
              lessonId={lesson.id}
            />
          </div>
        </div>

        <LessonStagePanel
          studentId={student.id}
          lessonId={lesson.id}
          passageId={mainPassage?.id}
          passageText={mainPassage?.passage_text ?? ""}
          state={{ stage: lessonState.stage }}
          questions={(questions ?? []) as any}
          vocabItems={(vocabItems ?? []) as any}
        />

        <div>
          <Link
            href={`/s/${code}`}
            className="text-sm text-slate-600 underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
