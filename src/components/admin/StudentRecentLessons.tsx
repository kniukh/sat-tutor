type LessonAttempt = {
  id: string;
  score: number | null;
  total_questions: number | null;
  accuracy: number | null;
  weak_skills: string[] | null;
  completed_at?: string | null;
  created_at: string;
  lessons?: {
    id: string;
    name: string;
    lesson_type: string;
  } | null;
};

export default function StudentRecentLessons({
  items,
}: {
  items: LessonAttempt[];
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Recent Lessons</h2>

      {items.length === 0 ? (
        <p className="text-slate-600">No lesson attempts yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="font-medium text-slate-900">
                {item.lessons?.name ?? 'Lesson'}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                {item.lessons?.lesson_type ?? 'lesson'} ·{' '}
                {new Date(item.completed_at || item.created_at).toLocaleString()}
              </div>

              <div className="mt-3 text-sm text-slate-700">
                Score: {item.score ?? 0} / {item.total_questions ?? 0}
              </div>

              <div className="mt-1 text-sm text-slate-700">
                Accuracy: {Math.round(Number(item.accuracy ?? 0) * 100)}%
              </div>

              <div className="mt-1 text-sm text-slate-700">
                Weak skills:{' '}
                {item.weak_skills && item.weak_skills.length > 0
                  ? item.weak_skills.join(', ')
                  : 'None'}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
