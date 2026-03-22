import Link from 'next/link';
import PassageVocabularyCapture from '@/components/student/PassageVocabularyCapture';
import LessonStagePanel from '@/components/student/LessonStagePanel';
import LessonSplitLayout from '@/components/student/LessonSplitLayout';
import ReadingProgressTracker from '@/components/student/ReadingProgressTracker';
import InteractivePassageReader from '@/components/student/InteractivePassageReader';
import LessonProgressHud from '@/components/student/LessonProgressHud';
import QuestionWorkspace from '@/components/student/QuestionWorkspace';
import WritingPanel from '@/components/student/WritingPanel';
import WritingHistory from '@/components/student/WritingHistory';
import { getPublishedLessonById } from '@/services/content/content.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getLessonSequenceByCurrentLessonId } from '@/services/reading/reading.service';
import { getOrCreateStudentLessonState } from '@/services/lesson-state/lesson-state.service';

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ code: string; lessonId: string }>;
}) {
  const { code, lessonId } = await params;

  const lesson = await getPublishedLessonById(lessonId);
  const supabase = createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('access_code', code)
    .eq('is_active', true)
    .single();

  if (studentError || !student) {
    throw new Error('Student not found');
  }

  const lessonState = await getOrCreateStudentLessonState(student.id, lesson.id);

  const { previousLesson, nextLesson, currentGeneratedPassage } =
    await getLessonSequenceByCurrentLessonId(lesson.id);

  const passages = (lesson.lesson_passages ?? []).sort(
    (a: { display_order: number }, b: { display_order: number }) =>
      a.display_order - b.display_order,
  );

  const mainPassage = passages[0] ?? null;

  const questions = (lesson.question_bank ?? []).sort(
    (a: { display_order: number }, b: { display_order: number }) =>
      a.display_order - b.display_order,
  );

  const strategy = currentGeneratedPassage?.question_strategy ?? 'full_set';

  const { data: vocabItems } = await supabase
    .from('vocabulary_item_details')
    .select('*')
    .eq('student_id', student.id)
    .eq('lesson_id', lesson.id)
    .order('created_at', { ascending: true });

  const { data: writingPrompts } = await supabase
    .from('lesson_writing_prompts')
    .select('*')
    .eq('lesson_id', lesson.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const { data: writingSubmissions } = await supabase
    .from('student_writing_submissions')
    .select('*')
    .eq('student_id', student.id)
    .eq('lesson_id', lesson.id)
    .order('created_at', { ascending: false });

  const activeWritingPrompt = writingPrompts?.[0] ?? null;

  const collectedWordsCount = (vocabItems ?? []).length;
  const partLabel =
    typeof currentGeneratedPassage?.chunk_index === 'number'
      ? `Part ${currentGeneratedPassage.chunk_index + 1}`
      : null;

  const topContent = (
    <div className="space-y-6">
      <LessonProgressHud
        partLabel={partLabel}
        stage={lessonState.stage}
        collectedWordsCount={collectedWordsCount}
        totalQuestions={lessonState.stage === 'questions' ? questions.length : 0}
        answeredQuestions={0}
      />

      <div>
        <h1 className="text-3xl font-semibold text-slate-900">{lesson.name}</h1>
        <p className="mt-2 text-slate-600">
          Lesson type: {lesson.lesson_type} · Stage: {lessonState.stage}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {previousLesson ? (
          <Link
            href={`/s/${code}/lesson/${previousLesson.id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900"
          >
            ← Previous
          </Link>
        ) : null}

        {nextLesson ? (
          <Link
            href={`/s/${code}/lesson/${nextLesson.id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900"
          >
            Next →
          </Link>
        ) : null}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Passage</h2>

        <div className="space-y-6">
          {passages.map(
            (passage: {
              id: string;
              title?: string | null;
              passage_text: string;
            }) => (
              <article key={passage.id}>
                <InteractivePassageReader
                  title={passage.title}
                  text={passage.passage_text}
                  vocabItems={(vocabItems ?? []) as any}
                  studentId={student.id}
                  lessonId={lesson.id}
                  passageId={passage.id}
                />

                {lessonState.stage === 'first_read' ? (
                  <PassageVocabularyCapture
                    studentId={student.id}
                    lessonId={lesson.id}
                    passageId={passage.id}
                    passageText={passage.passage_text}
                  />
                ) : null}
              </article>
            ),
          )}
        </div>
      </div>
    </div>
  );

  const bottomContent =
    lessonState.stage === 'questions' ? (
      strategy === 'none' ? (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Reading Check</h2>
          <p className="text-slate-600">
            This passage is for reading continuity. No questions here.
          </p>

          {nextLesson ? (
            <Link
              href={`/s/${code}/lesson/${nextLesson.id}`}
              className="inline-block rounded-xl bg-slate-900 px-5 py-3 text-white"
            >
              Continue Reading
            </Link>
          ) : null}
        </div>
      ) : questions.length === 0 ? (
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Reading Check</h2>
          <p className="mt-3 text-slate-600">No approved questions yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <QuestionWorkspace
            lessonId={lesson.id}
            studentId={student.id}
            questions={questions as any}
            partLabel={partLabel}
            stage={lessonState.stage}
            collectedWordsCount={collectedWordsCount}
            initialAnswers={(lessonState.question_answers_json ?? {}) as Record<
              string,
              'A' | 'B' | 'C' | 'D'
            >}
            initialQuestionIndex={lessonState.current_question_index ?? 0}
          />

          {activeWritingPrompt ? (
            <WritingPanel
              studentId={student.id}
              lessonId={lesson.id}
              prompt={activeWritingPrompt}
            />
          ) : null}

          <WritingHistory items={(writingSubmissions ?? []) as any} />
        </div>
      )
    ) : (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Lesson Workspace</h2>
        <LessonStagePanel
          studentId={student.id}
          lessonId={lesson.id}
          passageId={mainPassage?.id ?? ''}
          stage={lessonState.stage}
          vocabItems={(vocabItems ?? []) as any}
        />
      </div>
    );

  return (
    <div className="px-6 py-8">
      <ReadingProgressTracker studentId={student.id} lessonId={lesson.id} />

      <div className="mx-auto max-w-6xl">
        <LessonSplitLayout top={topContent} bottom={bottomContent} />
      </div>
    </div>
  );
}