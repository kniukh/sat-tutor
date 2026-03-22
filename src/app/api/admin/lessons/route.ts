import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();

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

  const supabase = createServerSupabaseClient();

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