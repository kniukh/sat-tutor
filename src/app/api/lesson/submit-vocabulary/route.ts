import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { updateStudentLessonStage } from '@/services/lesson-state/lesson-state.service';
import { generateVocabularyExplanations } from '@/services/ai/generate-vocabulary-explanations';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    passageId,
  }: {
    studentId: string;
    lessonId: string;
    passageId: string;
  } = body;

  const supabase = createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const { data: passage, error: passageError } = await supabase
    .from('lesson_passages')
    .select('*')
    .eq('id', passageId)
    .single();

  if (passageError || !passage) {
    return NextResponse.json({ error: 'Passage not found' }, { status: 404 });
  }

  const { data: captures, error: capturesError } = await supabase
    .from('vocabulary_capture_events')
    .select('*')
    .eq('student_id', studentId)
    .eq('lesson_id', lessonId)
    .eq('passage_id', passageId)
    .order('created_at', { ascending: true });

  if (capturesError) {
    return NextResponse.json({ error: capturesError.message }, { status: 500 });
  }

  if (!captures || captures.length === 0) {
    return NextResponse.json({ error: 'No captured vocabulary items found' }, { status: 400 });
  }

  const uniqueItemsMap = new Map<string, { item_text: string; item_type: 'word' | 'phrase' }>();

  for (const item of captures) {
    const key = `${item.item_type}:${item.item_text}`;
    if (!uniqueItemsMap.has(key)) {
      uniqueItemsMap.set(key, {
        item_text: item.item_text,
        item_type: item.item_type,
      });
    }
  }

  const uniqueItems = Array.from(uniqueItemsMap.values());

  let explanations;
  try {
    explanations = await generateVocabularyExplanations({
      nativeLanguage: student.native_language ?? 'ru',
      passageText: passage.passage_text,
      items: uniqueItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Vocabulary explanation generation failed' },
      { status: 500 },
    );
  }

  for (const item of explanations) {
    const { error: insertError } = await supabase
      .from('vocabulary_item_details')
      .insert({
        student_id: studentId,
        lesson_id: lessonId,
        item_text: item.item_text,
        item_type: item.item_type,
        english_explanation: item.plain_english_meaning,
        translated_explanation: item.translation,
        translation_language: student.native_language ?? 'ru',
        example_text: item.example_text,
        context_sentence: item.context_sentence,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  try {
    await updateStudentLessonStage({
      studentId,
      lessonId,
      stage: 'vocab_review',
      vocabSubmitted: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Stage update failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}