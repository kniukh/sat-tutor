import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createClient } from "@/lib/supabase/server";

function buildContextSnippet(fullText: string, itemText: string) {
  const lowerText = fullText.toLowerCase();
  const lowerItem = itemText.toLowerCase();
  const index = lowerText.indexOf(lowerItem);

  if (index === -1) return null;

  const start = Math.max(0, index - 28);
  const end = Math.min(fullText.length, index + itemText.length + 28);

  return fullText.slice(start, end).replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentId,
      lessonId,
      passageId,
      itemText,
      itemType,
      sourceType,
      contextText,
      metadata,
    } = body;

    if (!itemText || !itemType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const sessionStudentId = await requireStudentApiStudentId(studentId);

    const supabase = await createClient();

    let resolvedContextText: string | null = contextText?.trim() || null;

    if (!resolvedContextText && passageId) {
      const { data: passage } = await supabase
        .from("lesson_passages")
        .select("passage_text")
        .eq("id", passageId)
        .maybeSingle();

      resolvedContextText = passage?.passage_text
        ? buildContextSnippet(passage.passage_text, itemText)
        : null;
    }

    const { data, error } = await supabase
      .from("vocabulary_capture_events")
      .insert({
        student_id: sessionStudentId,
        lesson_id: lessonId ?? null,
        passage_id: passageId ?? null,
        item_text: itemText,
        item_type: itemType,
        context_text: resolvedContextText,
        source_type:
          sourceType === "question" ||
          sourceType === "answer" ||
          sourceType === "vocab_drill"
            ? sourceType
            : "passage",
        metadata:
          metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? metadata
            : {},
      })
      .select()
      .single();

    if (error) {
      console.error("capture-inline error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("capture-inline route error", error);
    return NextResponse.json(
      { error: "Failed to capture inline vocabulary" },
      { status: 500 }
    );
  }
}
