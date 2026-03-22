import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { updateWordProgress } from '@/services/vocabulary/vocabulary.service';
import { awardStudentActivity } from '@/services/gamification/gamification.service';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    score,
    totalQuestions,
    accuracy,
    weakSkills = [],
    weakWords = [],
    answersJson = [],
  } = body;

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('lesson_attempts')
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      score,
      total_questions: totalQuestions,
      accuracy,
      weak_skills: weakSkills,
      weak_words: weakWords,
      answers_json: answersJson,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await updateWordProgress({
      studentId,
      lessonId,
      weakWords,
    });
  } catch (wordError) {
    console.error('Word progress update failed:', wordError);
  }

  try {
    await awardStudentActivity({
      studentId,
      xpToAdd: 10,
    });
  } catch (gamificationError) {
    console.error('Gamification update failed:', gamificationError);
  }

  return NextResponse.json({ success: true, data });
}