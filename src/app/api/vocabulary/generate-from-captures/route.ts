import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateVocabularyCards } from "@/services/ai/generate-vocabulary-cards";
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

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, native_language")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      console.error("studentError", studentError);
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { data: captures, error: capturesError } = await supabase
      .from("vocabulary_capture_events")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (capturesError) {
      console.error("capturesError", capturesError);
      return NextResponse.json({ error: capturesError.message }, { status: 500 });
    }

    const uniqueItems = Array.from(
      new Map(
        (captures ?? []).map((item) => [item.item_text.toLowerCase(), item])
      ).values()
    );

    const itemsToGenerate: Array<{
      item_text: string;
      item_type: string;
      context_text?: string | null;
    }> = [];

    for (const item of uniqueItems) {
      const { data: existing, error: existingError } = await supabase
        .from("vocabulary_item_details")
        .select("id")
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId)
        .eq("item_text", item.item_text)
        .maybeSingle();

      if (existingError) {
        console.error("existingError", existingError);
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }

      if (!existing) {
        itemsToGenerate.push({
          item_text: item.item_text,
          item_type: item.item_type,
          context_text: item.context_text ?? null,
        });
      }
    }

    if (itemsToGenerate.length > 0) {
      let generated:
        | Array<{
            item_text: string;
            english_explanation: string;
            translated_explanation: string;
            example_text: string;
          }>
        | null = null;

      try {
        generated = await generateVocabularyCards({
          items: itemsToGenerate,
          nativeLanguage: student.native_language || "ru",
        });
      } catch (aiError) {
        console.error("generateVocabularyCards aiError", aiError);
      }

      for (const item of itemsToGenerate) {
        const aiCard = generated?.find(
          (x) => x.item_text.toLowerCase() === item.item_text.toLowerCase()
        );

        const { error: insertError } = await supabase
          .from("vocabulary_item_details")
          .insert({
            student_id: studentId,
            lesson_id: lessonId,
            item_text: item.item_text,
            item_type: item.item_type,
            english_explanation:
              aiCard?.english_explanation ?? `Meaning of "${item.item_text}"`,
            translated_explanation:
              aiCard?.translated_explanation ?? `Перевод: ${item.item_text}`,
            translation_language: student.native_language || "ru",
            example_text:
              aiCard?.example_text ?? `Example with "${item.item_text}".`,
            context_sentence:
              item.context_text ??
              `Context with "${item.item_text}" was not captured yet.`,
            audio_status: "pending",
          });

        if (insertError) {
          console.error("insertError", insertError);
        }
      }
    }

    const { data: pendingItems, error: pendingError } = await supabase
      .from("vocabulary_item_details")
      .select("id, item_text")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .in("audio_status", ["pending", "failed"]);

    if (pendingError) {
      console.error("pendingError", pendingError);
    }

    if ((pendingItems ?? []).length > 0) {
      try {
        const generatedAudio = await generateVocabularyAudioBulk(pendingItems);

        for (const item of generatedAudio) {
          const dataUrl = `data:audio/mpeg;base64,${item.audio_base64}`;

          const { error: updateAudioError } = await supabase
            .from("vocabulary_item_details")
            .update({
              audio_url: dataUrl,
              audio_status: "ready",
            })
            .eq("id", item.id);

          if (updateAudioError) {
            console.error("updateAudioError", updateAudioError);

            await supabase
              .from("vocabulary_item_details")
              .update({ audio_status: "failed" })
              .eq("id", item.id);
          }
        }
      } catch (audioError) {
        console.error("audioError", audioError);
      }
    }

    const { data: vocabItems, error: vocabError } = await supabase
      .from("vocabulary_item_details")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (vocabError) {
      console.error("vocabError", vocabError);
      return NextResponse.json({ error: vocabError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, items: vocabItems ?? [] });
  } catch (error) {
    console.error("generate-from-captures route error", error);
    return NextResponse.json(
      { error: "Failed to generate vocabulary items" },
      { status: 500 }
    );
  }
}