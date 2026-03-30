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
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Keep vocabulary moving</h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {dashboard.totals.practicedTodayWords} practiced today
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Captured
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {dashboard.totals.totalTrackedWords}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Mastered
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {dashboard.totals.masteredWords}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Practiced today
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {dashboard.totals.practicedTodayWords}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Ready to practice
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {dashboard.reviewIndicators.weakReinforcement} weak-word reinforcements
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {dashboard.totals.wordsInReview} words in review
            </span>
            {topLifecycle.length > 0 ? topLifecycle.map((item) => (
              <span
                key={item.lifecycleState}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {LIFECYCLE_LABELS[item.lifecycleState]} {item.count}
              </span>
            )) : (
              <span className="text-sm text-slate-500">Not enough data yet.</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Link
            href={`/s/${accessCode}/vocabulary?mode=mixed_practice`}
            className="rounded-[18px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Start Practice
          </Link>
          <Link
            href={`/s/${accessCode}/vocabulary?mode=review_weak_words&phase=endless_continuation`}
            className="rounded-[18px] border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Review Weak Words
          </Link>
        </div>
      </div>
    </section>
  );
}
