import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { getAiUsageByStudentReport } from "@/services/analytics/ai-usage-by-student.service";

function formatLastSeen(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminAiUsagePage() {
  await requireAdmin();

  const report = await getAiUsageByStudentReport();

  const stats = [
    { label: "Total Requests", value: report.summary.totalRequests },
    { label: "Total Tokens", value: report.summary.totalTokens.toLocaleString("en-US") },
    { label: "Cache Hit Rate", value: `${report.summary.cacheHitRate}%` },
    { label: "Tracked Students", value: report.summary.trackedStudents },
  ];

  return (
    <AdminShell
      title="AI Usage by Student"
      subtitle="Token spend, request volume, cache efficiency, and recent AI activity per student."
    >
      <AdminStatsGrid items={stats} />

      <div className="card-surface p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="app-kicker">Usage Table</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Student AI consumption
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sorted by token usage. System/admin rows are kept separate for requests
              without a student owner.
            </p>
          </div>

          <div className="rounded-full bg-[var(--color-surface-muted)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Avg latency {report.summary.averageLatencyMs} ms
          </div>
        </div>

        {report.students.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-10 text-center text-sm font-medium text-slate-600">
            No AI usage logged yet.
          </div>
        ) : (
          <div className="mt-6 overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Requests</th>
                  <th className="px-3 py-3">Total Tokens</th>
                  <th className="px-3 py-3">Cached Tokens</th>
                  <th className="px-3 py-3">Cache Hit</th>
                  <th className="px-3 py-3">Success</th>
                  <th className="px-3 py-3">Avg Latency</th>
                  <th className="px-3 py-3">Last Route</th>
                  <th className="px-3 py-3">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {report.students.map((student) => (
                  <tr
                    key={student.studentId ?? "system"}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="px-3 py-4 align-top">
                      {student.studentId ? (
                        <Link
                          href={`/admin/students/${student.studentId}`}
                          className="font-semibold text-slate-950 hover:underline"
                        >
                          {student.studentName}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-950">
                          {student.studentName}
                        </span>
                      )}
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {student.accessCode}
                        {student.studentId && !student.isActive ? " · inactive" : ""}
                      </div>
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-950">
                      {student.requestCount.toLocaleString("en-US")}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {student.totalTokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {student.cachedInputTokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {student.cacheHitRate}%
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {student.successRate}%
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {student.averageLatencyMs} ms
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-4 text-slate-700">
                      {student.lastRoute ?? "-"}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {formatLastSeen(student.lastRequestAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
