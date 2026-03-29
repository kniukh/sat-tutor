import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateInlineVocabularyPreview } from '@/services/ai/generate-inline-vocabulary-preview';

function getItemType(text: string): 'word' | 'phrase' {
  return text.trim().includes(' ') ? 'phrase' : 'word';
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    passageId,
    itemText,
  }: {
    studentId: string;
    lessonId: string;
    passageId: string;
    itemText: string;
  } = body;

  if (!studentId || !lessonId || !passageId || !itemText?.trim()) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

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

  try {
    const itemType = getItemType(itemText);
    const preview = await generateInlineVocabularyPreview({
      nativeLanguage: student.native_language ?? 'ru',
      passageText: passage.passage_text,
      itemText: itemText.trim(),
      itemType,
    });

    return NextResponse.json({ data: preview });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Preview generation failed' },
      { status: 500 },
    );
  }
}
