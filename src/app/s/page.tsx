import { requireStudentSession } from "@/lib/auth/student";
import StudentDashboardOverview from "@/components/student/StudentDashboardOverview";
import { getStudentDashboardData } from "@/services/progress/student-dashboard.service";
import ReadingCoachBrand from "@/components/student/ReadingCoachBrand";
import FeedbackSettingsButton from "@/components/student/FeedbackSettingsButton";
import StudentLogoutButton from "@/components/student/StudentLogoutButton";

export default async function CanonicalStudentDashboardPage() {
  const session = await requireStudentSession();
  const dashboard = await getStudentDashboardData(session.studentId);

  return (
    <div className="content-shell">
      <div className="space-y-6">
        <header className="coach-topbar">
          <ReadingCoachBrand />
          <div className="flex items-center gap-2">
            <FeedbackSettingsButton />
            <StudentLogoutButton />
          </div>
        </header>
        <div>
          <div className="coach-eyebrow">Your learning path</div>
          <h1 className="coach-page-title">Welcome back, {session.fullName.split(" ")[0]}!</h1>
          <p className="coach-page-copy">Keep your momentum going with today&apos;s next step.</p>
        </div>

        <StudentDashboardOverview
          currentBooks={dashboard?.currentBooks ?? []}
          readyVocabularyCount={dashboard?.readyVocabularyCount ?? 0}
          gamification={dashboard?.gamification ?? null}
          leaderboard={dashboard?.leaderboard ?? null}
          vocabularyAnalytics={dashboard?.vocabularyAnalytics ?? null}
          accessCode={session.accessCode}
        />
      </div>
    </div>
  );
}
