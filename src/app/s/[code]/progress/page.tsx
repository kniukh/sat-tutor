import { getStudentDashboard } from '@/services/progress/progress.service';

export default async function StudentProgressPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getStudentDashboard(code);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Progress</h1>
        <p className="mt-2 text-slate-600">{data.student.full_name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Lessons completed</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {data.summary.lessonsCompleted}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Average accuracy</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">
            {Math.round(data.summary.averageAccuracy * 100)}%
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Focus areas</div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {data.analytics.focusAreas.length > 0
              ? data.analytics.focusAreas.join(', ')
              : 'No major weak areas yet'}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">
          Weak skills analysis
        </h2>

        {data.analytics.weakSkills.length === 0 ? (
          <p className="text-slate-600">No weak skills detected yet.</p>
        ) : (
          <div className="space-y-3">
            {data.analytics.weakSkills.map((item) => (
              <div
                key={item.skill}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-semibold text-slate-900">
                    {item.skill}
                  </div>
                  <div className="text-sm text-slate-600">
                    Frequency: {Math.round(item.frequency * 100)}%
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Wrong count: {item.wrongCount} · Attempts affected:{' '}
                  {item.attemptsAffected}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">
          Recent attempts
        </h2>

        {data.attempts.length === 0 ? (
          <p className="text-slate-600">No attempts yet.</p>
        ) : (
          <div className="space-y-4">
            {data.attempts.map((attempt: any) => (
              <div
                key={attempt.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Lesson ID: {attempt.lesson_id}
                    </div>
                    <div className="text-sm text-slate-500">
                      Completed: {new Date(attempt.completed_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {attempt.score} / {attempt.total_questions}
                    </div>
                    <div className="text-sm text-slate-600">
                      {Math.round(Number(attempt.accuracy) * 100)}%
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-600">
                  Weak skills:{' '}
                  {Array.isArray(attempt.weak_skills) && attempt.weak_skills.length > 0
                    ? attempt.weak_skills.join(', ')
                    : 'None'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}