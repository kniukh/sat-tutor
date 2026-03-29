import { NextResponse } from 'next/server';
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
    nativeLanguage?: 'ru' | 'ro' | 'en';
  } = body;

  if (!fullName || !accessCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('students')
    .insert({
      full_name: fullName,
      email,
      access_code: accessCode,
      native_language: nativeLanguage,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
