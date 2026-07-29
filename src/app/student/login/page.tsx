import { redirect } from 'next/navigation';

import { StudentLoginForm } from '@/components/auth/StudentLoginForm';
import { getStudentSession } from '@/lib/auth/student';
import { studentDashboardPath } from '@/lib/routes/student';
import ReadingCoachBrand from '@/components/student/ReadingCoachBrand';

export default async function StudentLoginPage() {
  const session = await getStudentSession();

  if (session) {
    redirect(studentDashboardPath());
  }

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
          <StudentLoginForm />
        </div>
      </div>
    </div>
  );
}

