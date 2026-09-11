import { createClient } from "@/lib/supabase/server";
import StudentDashboardOverview from "@/components/student/StudentDashboardOverview";
import { getStudentDashboardData } from "@/services/progress/student-dashboard.service";
import ReadingCoachBrand from "@/components/student/ReadingCoachBrand";
import FeedbackSettingsButton from "@/components/student/FeedbackSettingsButton";
import StudentLogoutButton from "@/components/student/StudentLogoutButton";

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
      <div className="space-y-6">
        <header className="coach-topbar">
          <ReadingCoachBrand />
          <div className="flex items-center gap-2">
            <FeedbackSettingsButton />
            <StudentLogoutButton label="Switch student" />
          </div>
        </header>
        <div>
          <div className="coach-eyebrow">Your learning path</div>
          <h1 className="coach-page-title">Welcome back, {String(student.full_name).split(" ")[0]}!</h1>
          <p className="coach-page-copy">Keep your momentum going with today&apos;s next step.</p>
        </div>

        <StudentDashboardOverview
          currentBooks={dashboard?.currentBooks ?? []}
          readyVocabularyCount={dashboard?.readyVocabularyCount ?? 0}
          gamification={dashboard?.gamification ?? null}
          leaderboard={dashboard?.leaderboard ?? null}
          vocabularyAnalytics={dashboard?.vocabularyAnalytics ?? null}
          guidedLearning={dashboard?.guidedLearning ?? null}
          accessCode={code}
        />
      </div>
    </div>
  );
}
