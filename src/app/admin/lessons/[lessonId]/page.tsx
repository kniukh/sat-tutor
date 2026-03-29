import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AddPassageForm } from '@/components/admin/AddPassageForm';
import { AddQuestionForm } from '@/components/admin/AddQuestionForm';
import LessonStatusToggle from '@/components/admin/LessonStatusToggle';
import GenerateQuestionsButton from '@/components/admin/GenerateQuestionsButton';
import QuestionReviewActions from '@/components/admin/QuestionReviewActions';
import RegenerateQuestionButton from '@/components/admin/RegenerateQuestionButton';
import RegenerateQuestionWithFeedback from '@/components/admin/RegenerateQuestionWithFeedback';
import { AdminShell } from '@/components/admin/AdminShell';
import AddWritingPromptForm from '@/components/admin/AddWritingPromptForm';
import GenerateWritingPromptButton from '@/components/admin/GenerateWritingPromptButton';
import WritingSubmissionsList from '@/components/admin/WritingSubmissionsList';

export default async function AdminLessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  await requireAdmin();

  const { lessonId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select(`
      *,
      lesson_passages (*),
      question_bank (*),
      lesson_writing_prompts (*)
    `)
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    throw new Error('Lesson not found');
  }

  const { data: writingSubmissions } = await supabase
    .from('student_writing_submissions')
    .select(`
      *,
      students (
        full_name,
        email
      )
    `)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false });

  const passages = (lesson.lesson_passages ?? []).sort(
    (a: { display_order: number }, b: { display_order: number }) =>
      a.display_order - b.display_order,
  );

  const questions = (lesson.question_bank ?? []).sort(
    (
      a: { generation_version?: number; display_order: number },
      b: { generation_version?: number; display_order: number },
    ) => {
      const versionDiff = (b.generation_version ?? 0) - (a.generation_version ?? 0);
      if (versionDiff !== 0) return versionDiff;
      return a.display_order - b.display_order;
    },
  );

  const writingPrompts = lesson.lesson_writing_prompts ?? [];

  return (
    <AdminShell title={lesson.name} subtitle={`${lesson.lesson_type} · ${lesson.status}`}>
      <div className="flex flex-wrap items-center gap-3">
        <LessonStatusToggle lessonId={lesson.id} status={lesson.status} />

        <a
          href={`/s/demo123/lesson/${lesson.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900"
        >
          Preview Lesson
        </a>

        <GenerateQuestionsButton lessonId={lesson.id} />
        <GenerateWritingPromptButton lessonId={lesson.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AddPassageForm lessonId={lesson.id} />
        <AddQuestionForm lessonId={lesson.id} />
        <AddWritingPromptForm lessonId={lesson.id} />
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Writing Prompts</h2>

        {writingPrompts.length === 0 ? (
          <p className="text-slate-600">No writing prompts yet.</p>
        ) : (
          <div className="space-y-3">
            {writingPrompts.map((prompt: any) => (
              <div key={prompt.id} className="rounded-xl border border-slate-200 p-4">
                <div className="font-medium text-slate-900">{prompt.prompt_text}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {prompt.prompt_type} · {prompt.is_active ? 'active' : 'inactive'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Passages</h2>

        {passages.length === 0 ? (
          <p className="text-slate-600">No passages yet.</p>
        ) : (
          <div className="space-y-4">
            {passages.map((passage: any) => (
              <div key={passage.id} className="rounded-xl border p-4">
                <div className="font-semibold text-slate-900">
                  {passage.title || 'Untitled passage'}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  Order: {passage.display_order}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-slate-700">
                  {passage.passage_text}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Questions</h2>

        {questions.length === 0 ? (
          <p className="text-slate-600">No questions yet.</p>
        ) : (
          <div className="space-y-4">
            {questions.map((question: any, index: number) => (
              <div key={question.id} className="rounded-xl border p-4">
                <div className="font-semibold text-slate-900">
                  {index + 1}. {question.question_text}
                </div>

                <div className="mt-2 text-sm text-slate-500">
                  Type: {question.question_type} · Correct: {question.correct_option} ·
                  Review: {question.review_status ?? 'draft'} · Source:{' '}
                  {question.generation_source ?? 'manual'} · Version:{' '}
                  {question.generation_version ?? 1}
                </div>

                <ul className="mt-3 space-y-1 text-slate-700">
                  <li>A. {question.option_a}</li>
                  <li>B. {question.option_b}</li>
                  <li>C. {question.option_c}</li>
                  <li>D. {question.option_d}</li>
                </ul>

                {question.explanation ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Explanation: {question.explanation}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <QuestionReviewActions
                    questionId={question.id}
                    reviewStatus={question.review_status ?? 'draft'}
                  />
                  <RegenerateQuestionButton questionId={question.id} />
                  <RegenerateQuestionWithFeedback questionId={question.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <WritingSubmissionsList items={(writingSubmissions ?? []) as any} />
    </AdminShell>
  );
}