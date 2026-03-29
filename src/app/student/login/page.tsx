import { StudentLoginForm } from '@/components/auth/StudentLoginForm';

export default function StudentLoginPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <StudentLoginForm />
      </div>
    </div>
  );
}

