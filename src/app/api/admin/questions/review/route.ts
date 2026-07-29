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
