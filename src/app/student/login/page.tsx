import { redirect } from 'next/navigation';

import { StudentLoginForm } from '@/components/auth/StudentLoginForm';
import { getStudentSession } from '@/lib/auth/student';
import { studentDashboardPath } from '@/lib/routes/student';

export default async function StudentLoginPage() {
  const session = await getStudentSession();

  if (session) {
    redirect(studentDashboardPath());
  }

  return (
    <div className="min-h-screen px-4 py-12 sm:py-16">
      <div className="content-shell flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <div className="w-full max-w-3xl space-y-5 text-center">
          <div>
            <div className="app-kicker">Student Access</div>
            <h1 className="token-text-primary mt-1 text-3xl font-semibold tracking-[-0.03em]">
              Pick up your learning fast
            </h1>
            <p className="token-text-secondary mt-2 text-sm leading-6">
              Enter your student code to continue reading, vocabulary practice, and weekly progress.
            </p>
          </div>
          <StudentLoginForm />
        </div>
      </div>
    </div>
  );
}

