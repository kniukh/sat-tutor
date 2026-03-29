import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { lessonId, promptText } = body as {
    lessonId: string;
    promptText: string;
  };

  if (!lessonId || !promptText?.trim()) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('lesson_writing_prompts')
    .insert({
      lesson_id: lessonId,
      prompt_text: promptText.trim(),
      prompt_type: 'short_answer',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
