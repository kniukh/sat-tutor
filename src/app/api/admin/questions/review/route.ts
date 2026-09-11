import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isAdminApiAuthError, requireAdminApi } from '@/lib/auth/admin';

export async function POST(request: Request) {
  try {
    await requireAdminApi();
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const body = await request.json();
  const { questionId, reviewStatus } = body;

  if (!questionId || !['draft', 'approved', 'rejected'].includes(reviewStatus)) {
    return NextResponse.json({ error: 'Invalid questionId or reviewStatus' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('question_bank')
    .update({
      review_status: reviewStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  try {
    await requireAdminApi();
  } catch (error) {
    if (isAdminApiAuthError(error)) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  const body = await request.json();
  const questionId = String(body?.questionId ?? '').trim();
  const updates = {
    question_text: String(body?.questionText ?? '').trim(),
    option_a: String(body?.optionA ?? '').trim(),
    option_b: String(body?.optionB ?? '').trim(),
    option_c: String(body?.optionC ?? '').trim(),
    option_d: String(body?.optionD ?? '').trim(),
    correct_option: String(body?.correctOption ?? '').trim().toUpperCase(),
    review_status: 'draft',
    updated_at: new Date().toISOString(),
  };
  if (!questionId || Object.values(updates).some((value) => !value) || !['A', 'B', 'C', 'D'].includes(updates.correct_option)) {
    return NextResponse.json({ error: 'Complete question fields are required' }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('question_bank').update(updates).eq('id', questionId).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to update question' }, { status: 500 });
  return NextResponse.json({ data });
}
