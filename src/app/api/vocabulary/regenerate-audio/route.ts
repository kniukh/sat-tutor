import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateVocabularyAudioBulk } from "@/services/ai/generate-vocabulary-audio-bulk";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, lessonId } = body;

    if (!studentId || !lessonId) {
      return NextResponse.json(
        { error: "studentId and lessonId are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: items, error } = await supabase
      .from("vocabulary_item_details")
      .select("id, item_text")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId);

    if (error) {
      console.error("regenerate-audio items error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const validItems = (items ?? []).filter(
      (item) => item.item_text && item.item_text.trim().length > 0
    );

    if (!validItems.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const generated = await generateVocabularyAudioBulk(validItems);

    for (const item of generated) {
      const dataUrl = `data:audio/mpeg;base64,${item.audio_base64}`;

      const { error: updateError } = await supabase
        .from("vocabulary_item_details")
        .update({
          audio_url: dataUrl,
          audio_status: "ready",
        })
        .eq("id", item.id);

      if (updateError) {
        console.error("regenerate-audio updateError", updateError);

        await supabase
          .from("vocabulary_item_details")
          .update({ audio_status: "failed" })
          .eq("id", item.id);
      }
    }

    const { data: updatedItems, error: updatedItemsError } = await supabase
      .from("vocabulary_item_details")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (updatedItemsError) {
      console.error("regenerate-audio updatedItemsError", updatedItemsError);
      return NextResponse.json(
        { error: updatedItemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, items: updatedItems ?? [] });
  } catch (error) {
    console.error("regenerate-audio route error", error);
    return NextResponse.json(
      { error: "Failed to regenerate audio" },
      { status: 500 }
    );
  }
}