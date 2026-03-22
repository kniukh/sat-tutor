import Link from 'next/link';
import { getBookOverviewForStudent } from '@/services/reading/book-overview.service';

function stateBadge(state: 'completed' | 'current' | 'upcoming') {
  if (state === 'completed') {
    return 'border-green-300 bg-green-50 text-green-700';
  }

  if (state === 'current') {
    return 'border-blue-300 bg-blue-50 text-blue-700';
  }

  return 'border-slate-300 bg-slate-50 text-slate-600';
}

export default async function StudentBookPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getBookOverviewForStudent(code);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {data.sourceDocument?.title ?? 'Book Overview'}
        </h1>
        <p className="mt-2 text-slate-600">{data.student.full_name}</p>
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">Book progress</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {data.summary.progressPercent}%
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {data.summary.completedParts} / {data.summary.totalParts} parts completed
            </div>
          </div>

          {data.summary.currentLessonId ? (
            <Link
              href={`/s/${code}/lesson/${data.summary.currentLessonId}`}
              className="rounded-xl bg-slate-900 px-5 py-3 text-white"
            >
              Resume Reading
            </Link>
          ) : null}
        </div>

        <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-slate-900"
            style={{ width: `${data.summary.progressPercent}%` }}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Reading Path</h2>

        {!data.items || data.items.length === 0 ? (
          <p className="text-slate-600">No reading lessons yet.</p>
        ) : (
          <div className="space-y-3">
            {data.items.map((item) => (
              <div
                key={item.generatedPassageId}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">
                      Part {item.chunkIndex + 1}: {item.lessonName}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      Role: {item.passageRole} · Strategy: {item.questionStrategy}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-sm ${stateBadge(
                        item.progressState as 'completed' | 'current' | 'upcoming',
                      )}`}
                    >
                      {item.progressState}
                    </span>

                    <Link
                      href={`/s/${code}/lesson/${item.lessonId}`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-white"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}