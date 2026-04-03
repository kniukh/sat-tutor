import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function hasAdminSession(session: string | undefined) {
  return session === 'authorized';
}

export async function GET() {
  const cookieStore = await cookies();
  if (!hasAdminSession(cookieStore.get('sat_admin_session')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('lessons')
    .select(`
      *,
      units (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!hasAdminSession(cookieStore.get('sat_admin_session')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const {
    unitId,
    name,
    slug,
    lessonType,
    instructions = '',
    difficulty = 2,
    estimatedMinutes = null,
    status = 'draft',
  } = body;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      unit_id: unitId,
      name,
      slug,
      lesson_type: lessonType,
      instructions,
      difficulty,
      estimated_minutes: estimatedMinutes,
      status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  if (!hasAdminSession(cookieStore.get('sat_admin_session')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();

  if (lessonError) {
    return NextResponse.json({ error: lessonError.message }, { status: 500 });
  }

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  const cleanupSteps = [
    () =>
      supabase
        .from('generated_passages')
        .update({ lesson_id: null })
        .eq('lesson_id', id),
    () =>
      supabase
        .from('student_book_progress')
        .update({ current_lesson_id: null })
        .eq('current_lesson_id', id),
    () => supabase.from('student_writing_submissions').delete().eq('lesson_id', id),
    () => supabase.from('vocabulary_capture_events').delete().eq('lesson_id', id),
    () => supabase.from('student_lesson_state').delete().eq('lesson_id', id),
    () => supabase.from('lesson_attempts').delete().eq('lesson_id', id),
    () => supabase.from('lesson_writing_prompts').delete().eq('lesson_id', id),
    () => supabase.from('lesson_passages').delete().eq('lesson_id', id),
    () => supabase.from('question_bank').delete().eq('lesson_id', id),
    () => supabase.from('lessons').delete().eq('id', id),
  ];

  for (const step of cleanupSteps) {
    const { error } = await step();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    deletedLessonId: id,
    deletedLessonName: lesson.name,
  });
}
