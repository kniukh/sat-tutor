'use client';

import Link from 'next/link';
import { DeleteLessonButton } from './DeleteLessonButton';
import { useMemo, useState } from 'react';

type LessonItem = {
  id: string;
  name: string;
  slug: string;
  lesson_type: string;
  status: string;
  content_mode?: 'sat' | 'det' | null;
};

export function LessonsTable({ lessons }: { lessons: LessonItem[] }) {
  const [mode, setMode] = useState<'all' | 'sat' | 'det'>('all');
  const filteredLessons = useMemo(() => mode === 'all' ? lessons : lessons.filter((lesson) => (lesson.content_mode ?? 'sat') === mode), [lessons, mode]);
  return (
    <div className="surface-panel rounded-2xl p-6">
      <h2 className="token-text-primary mb-4 text-xl font-semibold">Lessons</h2>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by reading mode">
        {(['all', 'sat', 'det'] as const).map((value) => (
          <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${mode === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-line bg-white text-slate-700'}`}>{value}</button>
        ))}
      </div>

      {filteredLessons.length === 0 ? (
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
              {filteredLessons.map((lesson) => (
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
                  <td className="token-text-secondary px-3 py-3">{lesson.lesson_type} · {(lesson.content_mode ?? 'sat').toUpperCase()}</td>
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
