import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createClient } from "@/lib/supabase/server";
import { generateVocabularyAudioBulk } from "@/services/ai/generate-vocabulary-audio-bulk";
import { resolveVocabularyLemma } from "@/services/vocabulary/vocabulary-normalization.service";

const MAX_AUDIO_ITEMS_PER_REQUEST = 8;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, lessonId } = body;
    const requestedKeys = Array.isArray(body.itemTexts)
      ? new Set(
          body.itemTexts
            .filter((item: unknown): item is string => typeof item === "string")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
        )
      : null;
    const requestedLemmaKeys = Array.isArray(body.itemTexts)
      ? new Set(
          body.itemTexts
            .filter((item: unknown): item is string => typeof item === "string")
            .map((item) =>
              resolveVocabularyLemma({
                itemText: item,
                itemType: item.includes(" ") ? "phrase" : "word",
              }).canonicalLemma
            )
            .filter(Boolean)
        )
      : null;

    if (!lessonId) {
      return NextResponse.json(
        { error: "studentId and lessonId are required" },
        { status: 400 }
      );
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);

    const supabase = await createClient();

    const { data: items, error } = await supabase
      .from("vocabulary_item_details")
      .select("id, item_text, canonical_lemma, audio_status, audio_url")
      .eq("student_id", sessionStudentId)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("regenerate-audio items error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const itemsToGenerate = (items ?? [])
      .filter((item) => {
        if (!item.item_text || item.item_text.trim().length === 0) {
          return false;
        }

        if (
          requestedKeys &&
          !requestedKeys.has(item.item_text.trim().toLowerCase()) &&
          !requestedLemmaKeys?.has(
            item.canonical_lemma?.trim().toLowerCase() ||
              resolveVocabularyLemma({
                itemText: item.item_text,
                itemType: item.item_text.includes(" ") ? "phrase" : "word",
              }).canonicalLemma
          )
        ) {
          return false;
        }

        if (item.audio_status === "ready" && item.audio_url) {
          return false;
        }

        return true;
      })
      .slice(0, MAX_AUDIO_ITEMS_PER_REQUEST);

    if (itemsToGenerate.length > 0) {
      const generated = await generateVocabularyAudioBulk(itemsToGenerate, {
        studentId: sessionStudentId,
      });

      const generatedIds = new Set(generated.map((item) => item.id));

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

      const failedItems = itemsToGenerate.filter((item) => !generatedIds.has(item.id));

      if (failedItems.length > 0) {
        await supabase
          .from("vocabulary_item_details")
          .update({ audio_status: "failed" })
          .in("id", failedItems.map((item) => item.id));
      }
    }

    const { data: updatedItems, error: updatedItemsError } = await supabase
      .from("vocabulary_item_details")
      .select("*")
      .eq("student_id", sessionStudentId)
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
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("regenerate-audio route error", error);
    return NextResponse.json(
      { error: "Failed to regenerate audio" },
      { status: 500 }
    );
  }
}
