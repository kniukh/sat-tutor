import { requireStudentSession } from "@/lib/auth/student";
import StudentDashboardOverview from "@/components/student/StudentDashboardOverview";
import { getStudentDashboardData } from "@/services/progress/student-dashboard.service";

export default async function CanonicalStudentDashboardPage() {
  const session = await requireStudentSession();
  const dashboard = await getStudentDashboardData(session.studentId);

  return (
    <div className="content-shell">
      <div className="space-y-5">
        <div>
          <h1 className="app-heading-xl">Welcome, {session.fullName}</h1>
          <p className="app-copy mt-2">Pick up where you left off.</p>
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
