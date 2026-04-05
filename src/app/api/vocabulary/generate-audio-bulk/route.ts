import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createClient } from "@/lib/supabase/server";
import { generateVocabularyAudioBulk } from "@/services/ai/generate-vocabulary-audio-bulk";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, lessonId } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: "studentId and lessonId are required" },
        { status: 400 }
      );
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);

    const supabase = await createClient();

    const { data: vocabItems, error: vocabError } = await supabase
      .from("vocabulary_item_details")
      .select("id, item_text, audio_status, audio_url")
      .eq("student_id", sessionStudentId)
      .eq("lesson_id", lessonId);

    if (vocabError) {
      console.error("generate-audio-bulk vocabError", vocabError);
      return NextResponse.json({ error: vocabError.message }, { status: 500 });
    }

    const itemsToGenerate = (vocabItems ?? []).filter((item) => {
      if (!item.item_text || item.item_text.trim().length === 0) {
        return false;
      }

      if (item.audio_status === "ready" && item.audio_url) {
        return false;
      }

      return true;
    });

    if (!itemsToGenerate.length) {
      const { data: items } = await supabase
        .from("vocabulary_item_details")
        .select("*")
        .eq("student_id", sessionStudentId)
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });

      return NextResponse.json({ ok: true, items: items ?? [] });
    }

    const generated = await generateVocabularyAudioBulk(itemsToGenerate, {
      studentId: sessionStudentId,
    });

    for (const item of generated) {
      const filePath = `${sessionStudentId}/${lessonId}/${item.id}.mp3`;
      const fileBuffer = Buffer.from(item.audio_base64, "base64");

      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(filePath, fileBuffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error("audio uploadError", uploadError);

        await supabase
          .from("vocabulary_item_details")
          .update({
            audio_status: "failed",
          })
          .eq("id", item.id);

        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("audio")
        .getPublicUrl(filePath);

      await supabase
        .from("vocabulary_item_details")
        .update({
          audio_url: publicUrlData.publicUrl,
          audio_status: "ready",
        })
        .eq("id", item.id);
    }

    const { data: updatedItems, error: updatedError } = await supabase
      .from("vocabulary_item_details")
      .select("*")
      .eq("student_id", sessionStudentId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (updatedError) {
      console.error("generate-audio-bulk updatedError", updatedError);
      return NextResponse.json({ error: updatedError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, items: updatedItems ?? [] });
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("generate-audio-bulk route error", error);
    return NextResponse.json(
      { error: "Failed to generate audio in bulk" },
      { status: 500 }
    );
  }
}
