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
    <div className="content-shell">
      <div className="space-y-5">
        <div>
          <h1 className="app-heading-xl">
            Welcome, {student.full_name}
          </h1>
          <p className="app-copy mt-2">Pick up where you left off.</p>
        </div>

        <StudentDashboardOverview
          currentBooks={dashboard?.currentBooks ?? []}
          readyVocabularyCount={dashboard?.readyVocabularyCount ?? 0}
          gamification={dashboard?.gamification ?? null}
          leaderboard={dashboard?.leaderboard ?? null}
          vocabularyAnalytics={dashboard?.vocabularyAnalytics ?? null}
          accessCode={code}
        />
      </div>
    </div>
  );
}
