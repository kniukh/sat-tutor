import Link from "next/link";
import type { VocabularyDashboardData } from "@/services/vocabulary/vocabulary-page.service";

const LIFECYCLE_LABELS = {
  new: "New",
  learning: "Learning",
  review: "In review",
  mastered: "Mastered",
  weak_again: "Weak again",
} as const;

export default function VocabularyDashboardSummary({
  dashboard,
  accessCode,
}: {
  dashboard: VocabularyDashboardData;
  accessCode: string;
}) {
  const topLifecycle = [...dashboard.masteryDistribution]
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Overview
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">What needs attention now</h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {dashboard.totals.totalTrackedWords} tracked words
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Due now
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {dashboard.reviewIndicators.dueNow}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Overdue
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {dashboard.reviewIndicators.overdueRetentionChecks}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Weak words
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {dashboard.totals.weakWords}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Current streak
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{dashboard.streak.current}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Mastery snapshot
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {topLifecycle.length > 0 ? (
              topLifecycle.map((item) => (
                <span
                  key={item.lifecycleState}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {LIFECYCLE_LABELS[item.lifecycleState]} {item.count}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">Not enough data yet.</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link
            href={`/s/${accessCode}/vocabulary?mode=review_weak_words`}
            className="rounded-[18px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Start Due Review
          </Link>
          <Link
            href={`/s/${accessCode}/vocabulary?mode=mixed_practice`}
            className="rounded-[18px] border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Mixed Practice
          </Link>
        </div>
      </div>
    </section>
  );
}
