import { createClient } from "@/lib/supabase/server";
import StudentDashboardOverview from "@/components/student/StudentDashboardOverview";
import { getStudentDashboardData } from "@/services/progress/student-dashboard.service";

export default async function StudentDashboardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("access_code", code)
    .eq("is_active", true)
    .single();

  if (error || !student) {
    throw new Error("Student not found");
  }

  const dashboard = await getStudentDashboardData(student.id);

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Welcome, {student.full_name}
          </h1>
          <p className="mt-2 text-slate-600">
            SAT Reading dashboard
          </p>
        </div>

        <StudentDashboardOverview
          weakestSkills={dashboard?.weakestSkills ?? []}
          dueVocabulary={dashboard?.dueVocabulary ?? []}
          recentLessons={dashboard?.recentLessons ?? []}
          currentBooks={dashboard?.currentBooks ?? []}
          gamification={dashboard?.gamification ?? null}
          accessCode={code}
        />
      </div>
    </div>
  );
}