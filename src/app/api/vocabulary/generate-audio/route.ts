import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateWordAudio } from '@/services/ai/generate-word-audio';

export async function POST(request: Request) {
  const body = await request.json();

  const {
    vocabularyItemId,
  }: {
    vocabularyItemId: string;
  } = body;

  if (!vocabularyItemId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: item, error: itemError } = await supabase
    .from('vocabulary_item_details')
    .select('*')
    .eq('id', vocabularyItemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: 'Vocabulary item not found' }, { status: 404 });
  }

  if (item.audio_url && item.audio_status === 'ready') {
    return NextResponse.json({
      data: {
        audioUrl: item.audio_url,
        audioStatus: item.audio_status,
      },
    });
  }

  try {
    const audioUrl = await generateWordAudio({
      text: item.item_text,
      itemType: item.item_type,
    });

    const { error: updateError } = await supabase
      .from('vocabulary_item_details')
      .update({
        audio_url: audioUrl,
        audio_status: 'ready',
      })
      .eq('id', item.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        audioUrl,
        audioStatus: 'ready',
      },
    });
  } catch (error: any) {
    await supabase
      .from('vocabulary_item_details')
      .update({
        audio_status: 'failed',
      })
      .eq('id', item.id);

    return NextResponse.json(
      { error: error?.message ?? 'Audio generation failed' },
      { status: 500 },
    );
  }
}