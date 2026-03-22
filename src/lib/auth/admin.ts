import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ADMIN_COOKIE = 'sat_admin_session';
const ADMIN_COOKIE_VALUE = 'authorized';

function getAdminEmail() {
  const value = process.env.ADMIN_LOGIN_EMAIL;

  if (!value) {
    throw new Error('Missing ADMIN_LOGIN_EMAIL');
  }

  return value;
}

function getAdminPassword() {
  const value = process.env.ADMIN_LOGIN_PASSWORD;

  if (!value) {
    throw new Error('Missing ADMIN_LOGIN_PASSWORD');
  }

  return value;
}

export async function loginAdmin(email: string, password: string) {
  if (email !== getAdminEmail() || password !== getAdminPassword()) {
    return { ok: false as const, error: 'Invalid admin credentials' };
  }

  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE, ADMIN_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return { ok: true as const };
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE)?.value;

  if (session !== ADMIN_COOKIE_VALUE) {
    redirect('/admin/login');
  }
}