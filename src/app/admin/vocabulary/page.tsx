import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { getWeeklyVocabularyForAllStudents } from "@/services/vocabulary/weekly-vocabulary.service";

export default async function AdminVocabularyPage() {
  await requireAdmin();

  const items = await getWeeklyVocabularyForAllStudents();

  return (
    <AdminShell
      title="Weekly Vocabulary"
      subtitle="Words captured in the last 7 days."
    >
      <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--color-border)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Access Code</th>
              <th className="px-4 py-3 text-left">Word</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Lesson</th>
              <th className="px-4 py-3 text-left">Open</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3">
                  {item.students?.full_name ?? "-"}
                </td>

                <td className="px-4 py-3">
                  {item.students?.access_code ?? "-"}
                </td>

                <td className="px-4 py-3 font-medium">
                  {item.item_text}
                </td>

                <td className="px-4 py-3">
                  {item.item_type}
                </td>

                <td className="px-4 py-3">
                  {item.lesson_id}
                </td>

                <td className="px-4 py-3">
                  {item.students?.access_code ? (
                    <Link
                      href={`/s/${item.students.access_code}/lesson/${item.lesson_id}`}
                      className="font-semibold text-slate-900 underline underline-offset-4"
                    >
                      Open
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>

                <td className="px-4 py-3 text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
