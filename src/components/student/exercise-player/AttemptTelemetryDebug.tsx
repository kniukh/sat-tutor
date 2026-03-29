import type { ReactNode } from "react";

type SummaryItem = {
  label: string;
  value: ReactNode;
};

type Props = {
  title?: string;
  summary: SummaryItem[];
  payload: unknown;
};

export default function AttemptTelemetryDebug({
  title = "Attempt Telemetry",
  summary,
  payload,
}: Props) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <details className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-4 shadow-sm sm:p-5">
      <summary className="cursor-pointer text-sm font-medium text-slate-700">{title}</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {item.label}
            </div>
            <div className="mt-2 break-all text-sm font-semibold text-slate-900">
              {item.value}
            </div>
          </div>
        ))}
      </div>
      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </details>
  );
}
