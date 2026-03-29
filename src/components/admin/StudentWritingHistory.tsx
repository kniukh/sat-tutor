type WritingSubmission = {
  id: string;
  response_text: string;
  ai_feedback: {
    overall_score?: number;
    clarity?: string;
    logic?: string;
    completeness?: string;
    concise_feedback?: string;
  } | null;
  created_at: string;
  lessons?: {
    id: string;
    name: string;
  } | null;
};

export default function StudentWritingHistory({
  items,
}: {
  items: WritingSubmission[];
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Writing History</h2>

      {items.length === 0 ? (
        <p className="text-slate-600">No writing submissions yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium text-slate-900">
                  {item.lessons?.name ?? 'Lesson'}
                </div>

                <div className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-sm font-medium text-slate-900">Response</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {item.response_text}
                </p>
              </div>

              {item.ai_feedback ? (
                <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Score:</span>{' '}
                    {item.ai_feedback.overall_score ?? '-'} / 5
                  </div>
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Feedback:</span>{' '}
                    {item.ai_feedback.concise_feedback ?? '-'}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
