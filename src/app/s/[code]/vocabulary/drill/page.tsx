import Link from "next/link";
import VocabSessionPlayer from "@/components/student/VocabSessionPlayer";
import {
  studentLessonPath,
  studentLibraryPath,
  studentVocabularyPath,
} from "@/lib/routes/student";
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
  searchParams: Promise<{
    mode?: string;
    phase?: string;
    lesson?: string;
    guided?: string;
    guidedWords?: string;
    nextLesson?: string;
  }>;
}) {
  const [{ code }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const selectedMode = normalizeVocabularyPageMode(resolvedSearchParams.mode);
  const selectedPhase = normalizeVocabularySessionPhase(resolvedSearchParams.phase);
  const preferredLessonId = normalizeVocabularyLessonId(resolvedSearchParams.lesson);
  const guidedLessonIntro = resolvedSearchParams.guided === "lesson_intro";
  const nextLessonId = normalizeVocabularyLessonId(resolvedSearchParams.nextLesson);
  let guidedWordTexts: string[] = [];

  if (resolvedSearchParams.guidedWords) {
    try {
      const parsed = JSON.parse(resolvedSearchParams.guidedWords);
      if (Array.isArray(parsed)) {
        guidedWordTexts = parsed
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      guidedWordTexts = [];
    }
  }

  const data = await getStudentVocabularyPageData(
    code,
    selectedMode,
    selectedPhase,
    preferredLessonId,
    {
      guidedLessonIntro,
      guidedWordTexts,
    }
  );
  const guidedCompletionAction =
    guidedLessonIntro
      ? {
          href: nextLessonId ? studentLessonPath(nextLessonId, code) : studentLibraryPath(),
          label: nextLessonId ? "Continue Reading" : "Back to Library",
        }
      : null;

  if (data.session) {
    return (
      <main className="min-h-[100svh] bg-white">
        <VocabSessionPlayer
          session={data.session}
          studentId={data.student.id}
          accessCode={data.student.accessCode}
          focused
          completionAction={guidedCompletionAction}
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
            {guidedLessonIntro && data.preparationNeeded
              ? data.summary.lessonFocus
                ? `The new words from ${data.summary.lessonFocus.lessonName} are still finishing their practice setup. Give it a moment, then jump back in.`
                : "Your new lesson words are still finishing their practice setup. Give it a moment, then jump back in."
              : data.preparationNeeded
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
            href={studentVocabularyPath({
              mode: selectedMode,
              phase: resolvedSearchParams.phase ?? undefined,
              lesson: preferredLessonId ?? undefined,
            })}
            className="primary-button w-full"
          >
            {guidedLessonIntro ? "Open Vocabulary Studio" : "Back to vocabulary"}
          </Link>
          {guidedCompletionAction ? (
            <Link
              href={guidedCompletionAction.href}
              className="secondary-button w-full"
            >
              Skip for now
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
