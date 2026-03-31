import { NextResponse } from 'next/server';
import { createAiLessonFromGeneratedPassage } from '@/services/content/create-ai-lesson-from-generated-passage.service';

export async function POST(request: Request) {
  const body = await request.json();
  const { generatedPassageId, unitId } = body;

  try {
    const lesson = await createAiLessonFromGeneratedPassage({
      generatedPassageId,
      unitId,
    });

    return NextResponse.json({ data: lesson });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create lesson' },
      { status: 500 },
    );
  }
}
