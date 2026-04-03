import Link from 'next/link';
import { DeleteLessonButton } from './DeleteLessonButton';

type LessonItem = {
  id: string;
  name: string;
  slug: string;
  lesson_type: string;
  status: string;
};

export function LessonsTable({ lessons }: { lessons: LessonItem[] }) {
  return (
    <div className="surface-panel rounded-2xl p-6">
      <h2 className="token-text-primary mb-4 text-xl font-semibold">Lessons</h2>

      {lessons.length === 0 ? (
        <p className="token-text-secondary">No lessons yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="token-text-muted border-b border-[var(--color-border)] text-left">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/lessons/${lesson.id}`}
                      className="token-text-primary font-medium hover:underline"
                    >
                      {lesson.name}
                    </Link>
                  </td>
                  <td className="token-text-secondary px-3 py-3">{lesson.slug}</td>
                  <td className="token-text-secondary px-3 py-3">{lesson.lesson_type}</td>
                  <td className="token-text-secondary px-3 py-3">{lesson.status}</td>
                  <td className="px-3 py-3">
                    <DeleteLessonButton lessonId={lesson.id} lessonName={lesson.name} />
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
