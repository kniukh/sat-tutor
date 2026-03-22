import { NextResponse } from 'next/server';
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
    nativeLanguage: 'ru' | 'ro' | 'en';
    isActive: boolean;
  } = body;

  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('students')
    .update({
      full_name: fullName,
      email,
      access_code: accessCode,
      native_language: nativeLanguage,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', studentId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}