import Link from "next/link";
import VocabSessionPlayer from "@/components/student/VocabSessionPlayer";
import {
  getStudentVocabularyPageData,
  normalizeVocabularyLessonId,
  normalizeVocabularyPageMode,
  normalizeVocabularySessionPhase,
} from "@/services/vocabulary/vocabulary-page.service";

export default async function FocusedVocabularyDrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ mode?: string; phase?: string; lesson?: string }>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const selectedMode = normalizeVocabularyPageMode(resolvedSearchParams.mode);
  const selectedPhase = normalizeVocabularySessionPhase(resolvedSearchParams.phase);
  const preferredLessonId = normalizeVocabularyLessonId(resolvedSearchParams.lesson);
  const data = await getStudentVocabularyPageData(
    code,
    selectedMode,
    selectedPhase,
    preferredLessonId
  );

  if (data.session) {
    return (
      <main className="min-h-[100svh] bg-white">
        <VocabSessionPlayer
          session={data.session}
          studentId={data.student.id}
          accessCode={data.student.accessCode}
          focused
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-white px-4 py-6 sm:px-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Focused Drill
          </div>
          <h1 className="text-3xl font-semibold text-slate-950">Nothing ready yet</h1>
          <p className="text-sm leading-6 text-slate-600">
            {data.preparationNeeded
              ? data.summary.lessonFocus
                ? `Words from ${data.summary.lessonFocus.lessonName} are still being prepared. Give it a moment, then jump back in.`
                : "Your next drill is still being prepared. Give it a moment, then open the focused session again."
              : data.summary.lessonFocus
                ? `There is no lesson-focused drill ready right now. Open Vocabulary Studio to let ${data.summary.lessonFocus.lessonName} flow into the next adaptive session.`
                : "There is no active drill session ready right now. Open Vocabulary Studio to let the next priority or continuation phase assemble."}
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href={`/s/${data.student.accessCode}/vocabulary?mode=${selectedMode}${
              resolvedSearchParams.phase ? `&phase=${resolvedSearchParams.phase}` : ""
            }${preferredLessonId ? `&lesson=${preferredLessonId}` : ""}`}
            className="primary-button w-full"
          >
            Back to vocabulary
          </Link>
        </div>
      </div>
    </main>
  );
}
