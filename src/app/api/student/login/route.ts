import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const access_code = (body?.access_code ?? '').toString().trim();

    if (!access_code) {
      return NextResponse.json({ error: 'Код доступа обязателен' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: student, error } = await supabase
      .from('students')
      .select('id,full_name,access_code,is_active')
      .eq('access_code', access_code)
      .eq('is_active', true)
      .single();

    if (error || !student) {
      return NextResponse.json({ error: 'Неверный код доступа или студент не активен' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, student: { id: student.id, full_name: student.full_name } });
  } catch (err) {
    return NextResponse.json({ error: 'Ошибка сервера при проверке кода' }, { status: 500 });
  }
}
