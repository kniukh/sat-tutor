import Link from 'next/link';

type StudentItem = {
  id: string;
  full_name: string;
  email: string | null;
  access_code: string;
  native_language: string;
  is_active: boolean;
};

type BookProgressItem = {
  student_id: string;
  progress_percent: number;
  current_lesson_id: string | null;
};

export function StudentsTable({
  students,
  bookProgress,
}: {
  students: StudentItem[];
  bookProgress: BookProgressItem[];
}) {
  const progressMap = new Map(bookProgress.map((item) => [item.student_id, item]));

  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Students</h2>

      {students.length === 0 ? (
        <p className="text-slate-600">No students yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Access code</th>
                <th className="px-3 py-2">Language</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Book progress</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const progress = progressMap.get(student.id);

                return (
                  <tr key={student.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/students/${student.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {student.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{student.email || '-'}</td>
                    <td className="px-3 py-3 text-slate-600">{student.access_code}</td>
                    <td className="px-3 py-3 text-slate-600">{student.native_language}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {student.is_active ? 'yes' : 'no'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {progress ? `${Math.round(Number(progress.progress_percent))}%` : '0%'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
