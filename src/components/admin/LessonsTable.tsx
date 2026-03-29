import Link from 'next/link';

type LessonItem = {
  id: string;
  name: string;
  slug: string;
  lesson_type: string;
  status: string;
  units?: Array<{
    id: string;
    name: string;
    slug: string;
  }> | null;
};

export function LessonsTable({ lessons }: { lessons: LessonItem[] }) {
  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Lessons</h2>

      {lessons.length === 0 ? (
        <p className="text-slate-600">No lessons yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Unit</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.id} className="border-b last:border-b-0">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/lessons/${lesson.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {lesson.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{lesson.slug}</td>
                  <td className="px-3 py-3 text-slate-600">{lesson.lesson_type}</td>
                  <td className="px-3 py-3 text-slate-600">{lesson.status}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {lesson.units?.[0]?.name ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
