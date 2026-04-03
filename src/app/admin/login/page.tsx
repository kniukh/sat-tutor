import { AdminLoginForm } from '@/components/auth/AdminLoginForm';

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen px-6 py-10 sm:py-14">
      <div className="content-shell flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="w-full max-w-2xl space-y-4 text-center">
          <div>
            <div className="app-kicker">Admin</div>
            <h1 className="token-text-primary mt-1 text-3xl font-semibold tracking-[-0.03em]">
              Sign in to manage content
            </h1>
            <p className="token-text-secondary mt-2 text-sm leading-6">
              Access students, sources, lessons, and review tools from one place.
            </p>
          </div>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
