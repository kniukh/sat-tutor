type Submission = {
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
  students?: {
    full_name?: string;
    email?: string | null;
  } | null;
};

export default function WritingSubmissionsList({
  items,
}: {
  items: Submission[];
}) {
  if (!items || items.length === 0) {
    return (
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Writing Submissions</h2>
        <p className="mt-3 text-slate-600">No submissions yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Writing Submissions</h2>

      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">
                  {item.students?.full_name ?? 'Student'}
                </div>
                <div className="text-sm text-slate-500">
                  {item.students?.email || 'No email'}
                </div>
              </div>

              <div className="text-xs text-slate-500">
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>

            <div className="mt-4">
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
                  <span className="font-medium">Clarity:</span>{' '}
                  {item.ai_feedback.clarity ?? '-'}
                </div>
                <div className="text-sm text-slate-700">
                  <span className="font-medium">Logic:</span>{' '}
                  {item.ai_feedback.logic ?? '-'}
                </div>
                <div className="text-sm text-slate-700">
                  <span className="font-medium">Completeness:</span>{' '}
                  {item.ai_feedback.completeness ?? '-'}
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
    </section>
  );
}
