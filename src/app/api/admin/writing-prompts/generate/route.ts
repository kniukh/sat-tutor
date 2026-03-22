import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateWritingPromptFromPassage } from '@/services/ai/generate-writing-prompt';

export async function POST(request: Request) {
  const body = await request.json();
  const { lessonId } = body as {
    lessonId: string;
  };

  if (!lessonId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  const { data: passages, error: passagesError } = await supabase
    .from('lesson_passages')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('display_order', { ascending: true });

  if (passagesError || !passages || passages.length === 0) {
    return NextResponse.json({ error: 'Passage not found' }, { status: 404 });
  }

  let generated;
  try {
    generated = await generateWritingPromptFromPassage({
      lessonName: lesson.name,
      passageText: passages.map((p) => p.passage_text).join('\n\n'),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Writing prompt generation failed' },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from('lesson_writing_prompts')
    .insert({
      lesson_id: lessonId,
      prompt_text: generated.prompt_text,
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