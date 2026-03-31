import { requireAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAllStudentsSkillDashboard } from "@/services/analytics/skill-dashboard.service";

export default async function AdminSkillsPage() {
  await requireAdmin();

  const items = await getAllStudentsSkillDashboard();

  return (
    <AdminShell
      title="Skill Tracking"
      subtitle="Accuracy by reading area for all students."
    >
      <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--color-border)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Access Code</th>
              <th className="px-4 py-3 text-left">Skill</th>
              <th className="px-4 py-3 text-left">Attempts</th>
              <th className="px-4 py-3 text-left">Correct</th>
              <th className="px-4 py-3 text-left">Accuracy</th>
              <th className="px-4 py-3 text-left">Updated</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3">{item.students?.full_name ?? "-"}</td>
                <td className="px-4 py-3">{item.students?.access_code ?? "-"}</td>
                <td className="px-4 py-3 font-medium">{item.skill}</td>
                <td className="px-4 py-3">{item.attempts_count}</td>
                <td className="px-4 py-3">{item.correct_count}</td>
                <td className="px-4 py-3">
                  {Math.round((Number(item.accuracy) || 0) * 100)}%
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(item.updated_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
