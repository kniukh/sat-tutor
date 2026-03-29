import { requireAdmin } from "@/lib/auth/admin";
import { getAllStudentsSkillDashboard } from "@/services/analytics/skill-dashboard.service";

export default async function AdminSkillsPage() {
  await requireAdmin();

  const items = await getAllStudentsSkillDashboard();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Skill Tracking</h1>
        <p className="text-slate-600">
          Accuracy by reading area for all students
        </p>
      </div>

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-4 py-3">Access Code</th>
              <th className="text-left px-4 py-3">Skill</th>
              <th className="text-left px-4 py-3">Attempts</th>
              <th className="text-left px-4 py-3">Correct</th>
              <th className="text-left px-4 py-3">Accuracy</th>
              <th className="text-left px-4 py-3">Updated</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-t">
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
    </div>
  );
}