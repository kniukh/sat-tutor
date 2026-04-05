import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { evaluateShortAnswer } from '@/services/ai/evaluate-short-answer';
import { awardStudentActivity } from '@/services/gamification/gamification.service';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    writingPromptId,
    responseText,
  }: {
    studentId: string;
    lessonId: string;
    writingPromptId: string;
    responseText: string;
  } = body;

  if (!lessonId || !writingPromptId || !responseText?.trim()) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  let sessionStudentId: string;

  try {
    sessionStudentId = await requireStudentApiStudentId(studentId);
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const supabase = await createServerSupabaseClient();

  const { data: lessonPassages, error: lessonPassagesError } = await supabase
    .from('lesson_passages')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('display_order', { ascending: true });

  if (lessonPassagesError || !lessonPassages || lessonPassages.length === 0) {
    return NextResponse.json({ error: 'Passage not found' }, { status: 404 });
  }

  const { data: writingPrompt, error: promptError } = await supabase
    .from('lesson_writing_prompts')
    .select('*')
    .eq('id', writingPromptId)
    .single();

  if (promptError || !writingPrompt) {
    return NextResponse.json({ error: 'Writing prompt not found' }, { status: 404 });
  }

  let feedback;
  try {
    feedback = await evaluateShortAnswer({
      passageText: lessonPassages.map((p) => p.passage_text).join('\n\n'),
      promptText: writingPrompt.prompt_text,
      studentResponse: responseText,
      studentId: sessionStudentId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Writing evaluation failed' },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from('student_writing_submissions')
    .insert({
      student_id: sessionStudentId,
      lesson_id: lessonId,
      writing_prompt_id: writingPromptId,
      response_text: responseText,
      ai_feedback: feedback,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await awardStudentActivity({
      studentId: sessionStudentId,
      xpToAdd: 8,
    });
  } catch (gamificationError) {
    console.error('Gamification update failed:', gamificationError);
  }

  return NextResponse.json({ data });
}
