import { NextResponse } from 'next/server';
import { loginAdmin } from '@/lib/auth/admin';

export async function POST(request: Request) {
  const body = await request.json();

  const email = String(body?.email ?? '');
  const password = String(body?.password ?? '');

  const result = await loginAdmin(email, password);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
