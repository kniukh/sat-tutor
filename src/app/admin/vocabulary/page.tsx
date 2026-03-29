import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getWeeklyVocabularyForAllStudents } from "@/services/vocabulary/weekly-vocabulary.service";

export default async function AdminVocabularyPage() {
  await requireAdmin();

  const items = await getWeeklyVocabularyForAllStudents();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Weekly Vocabulary</h1>
        <p className="text-slate-600">
          Words captured in the last 7 days
        </p>
      </div>

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3">Student</th>
              <th className="text-left px-4 py-3">Access Code</th>
              <th className="text-left px-4 py-3">Word</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Lesson</th>
              <th className="text-left px-4 py-3">Open</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-t">
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
                      className="text-blue-600 underline"
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
    </div>
  );
}