import { NextResponse } from 'next/server';
import { normalizeStudentAccessCode } from '@/lib/auth/student-access-code';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    fullName,
    email = '',
    accessCode,
    nativeLanguage = 'ru',
  }: {
    fullName: string;
    email?: string;
    accessCode: string;
    nativeLanguage?: 'ru' | 'ro' | 'uk' | 'en';
  } = body;

  const normalizedAccessCode = normalizeStudentAccessCode(accessCode ?? '');

  if (!fullName?.trim() || !normalizedAccessCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['ru', 'ro', 'uk', 'en'].includes(nativeLanguage)) {
    return NextResponse.json({ error: 'Unsupported native language' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('students')
    .insert({
      full_name: fullName.trim(),
      email,
      access_code: normalizedAccessCode,
      native_language: nativeLanguage,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === '23505' ? 'Этот код доступа уже используется' : error.message },
      { status: error.code === '23505' ? 409 : 500 },
    );
  }

  return NextResponse.json({ data });
}
