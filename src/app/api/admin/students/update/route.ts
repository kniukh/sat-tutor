import { NextResponse } from 'next/server';
import { normalizeStudentAccessCode } from '@/lib/auth/student-access-code';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    fullName,
    email,
    accessCode,
    nativeLanguage,
    isActive,
  }: {
    studentId: string;
    fullName: string;
    email: string;
    accessCode: string;
    nativeLanguage: 'ru' | 'ro' | 'uk' | 'en';
    isActive: boolean;
  } = body;

  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }
  const normalizedAccessCode = normalizeStudentAccessCode(accessCode ?? '');
  if (!fullName?.trim() || !normalizedAccessCode) {
    return NextResponse.json({ error: 'Full name and access code are required' }, { status: 400 });
  }
  if (!['ru', 'ro', 'uk', 'en'].includes(nativeLanguage)) {
    return NextResponse.json({ error: 'Unsupported native language' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('students')
    .update({
      full_name: fullName.trim(),
      email,
      access_code: normalizedAccessCode,
      native_language: nativeLanguage,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', studentId)
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
