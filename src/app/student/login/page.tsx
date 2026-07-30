import Link from "next/link";

import { StudentLoginForm } from '@/components/auth/StudentLoginForm';
import { getStudentSession } from '@/lib/auth/student';
import { studentDashboardPath } from '@/lib/routes/student';
import ReadingCoachBrand from '@/components/student/ReadingCoachBrand';
import StudentLogoutButton from "@/components/student/StudentLogoutButton";

export default async function StudentLoginPage() {
  const session = await getStudentSession();

  return (
    <div className="min-h-screen px-4 py-12 sm:py-16">
      <div className="content-shell flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <div className="w-full max-w-3xl space-y-6 text-center">
          <div className="flex justify-center"><ReadingCoachBrand /></div>
          <div>
            <div className="coach-eyebrow justify-center">Student access</div>
            <h1 className="coach-page-title">
              Read with purpose. Grow every day.
            </h1>
            <p className="coach-page-copy">
              Enter your student code to continue your reading path, vocabulary, XP, and streak.
            </p>
          </div>
          {session ? (
            <div className="surface-soft-panel mx-auto flex max-w-md flex-col gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-left sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="token-text-muted text-xs font-semibold uppercase tracking-[0.14em]">
                  Currently signed in
                </div>
                <div className="token-text-primary mt-1 truncate font-semibold">
                  {session.fullName}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={studentDashboardPath()} className="primary-button min-h-11 px-4">
                  Continue
                </Link>
                <StudentLogoutButton label="Switch student" />
              </div>
            </div>
          ) : null}
          <StudentLoginForm />
        </div>
      </div>
    </div>
  );
}

