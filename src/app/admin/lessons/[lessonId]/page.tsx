import { requireAdmin } from '@/lib/auth/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import InlineLessonReview from '@/components/admin/InlineLessonReview';
import { AddPassageForm } from '@/components/admin/AddPassageForm';
import { AddQuestionForm } from '@/components/admin/AddQuestionForm';
import LessonStatusToggle from '@/components/admin/LessonStatusToggle';
import { AdminShell } from '@/components/admin/AdminShell';
import AddWritingPromptForm from '@/components/admin/AddWritingPromptForm';
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
    <AdminShell title={lesson.name} subtitle={`${lesson.lesson_type} lesson review`}>
      <div className="flex flex-wrap items-center gap-3">
        <LessonStatusToggle lessonId={lesson.id} status={lesson.status} />
      </div>

      <InlineLessonReview
        lessonId={lesson.id}
        lessonStatus={lesson.status}
        lessonType={lesson.lesson_type}
        passages={passages as any}
        questions={questions as any}
      />

      <section className="card-surface p-5 sm:p-6">
        <div className="app-kicker">Manual Additions</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-950">
          Add or extend lesson content
        </h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          <AddPassageForm lessonId={lesson.id} />
          <AddQuestionForm lessonId={lesson.id} />
          <AddWritingPromptForm lessonId={lesson.id} />
        </div>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="app-kicker">Writing Prompts</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-950">
          Prompt set
        </h2>

        {writingPrompts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No writing prompts yet.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {writingPrompts.map((prompt: any) => (
              <div key={prompt.id} className="rounded-[1.25rem] border border-[var(--color-border)] bg-white p-4">
                <div className="font-medium text-slate-900">{prompt.prompt_text}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {prompt.prompt_type} · {prompt.is_active ? 'active' : 'inactive'}
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
