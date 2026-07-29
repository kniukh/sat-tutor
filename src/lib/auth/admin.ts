import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '@/lib/auth/admin-session';

export class AdminApiAuthError extends Error {
  status = 401;

  constructor() {
    super('Unauthorized');
    this.name = 'AdminApiAuthError';
  }
}

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

  cookieStore.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true as const };
}

export async function requireAdmin() {
  const requestHeaders = await headers();
  if (requestHeaders.get('x-sat-admin-authenticated') === '1') {
    return;
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!(await verifyAdminSessionToken(session))) {
    redirect('/admin/login');
  }
}

export async function requireAdminApi() {
  const cookieStore = await cookies();
  if (!(await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value))) {
    throw new AdminApiAuthError();
  }
}

export function isAdminApiAuthError(error: unknown): error is AdminApiAuthError {
  return error instanceof AdminApiAuthError;
}
