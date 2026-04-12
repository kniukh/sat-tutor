import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createClient } from "@/lib/supabase/server";
import { recordVocabularyCaptures } from "@/services/vocabulary/vocabulary-capture.service";

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

    let resolvedContextText: string | null = contextText?.trim() || null;

    if (!resolvedContextText && passageId) {
      const supabase = await createClient();
      const { data: passage } = await supabase
        .from("lesson_passages")
        .select("passage_text")
        .eq("id", passageId)
        .maybeSingle();

      resolvedContextText = passage?.passage_text
        ? buildContextSnippet(passage.passage_text, itemText)
        : null;
    }

    const result = await recordVocabularyCaptures({
      studentId: sessionStudentId,
      lessonId: lessonId ?? null,
      passageId: passageId ?? null,
      items: [
        {
          itemText,
          itemType,
          sourceType,
          contextText: resolvedContextText,
          metadata:
            metadata && typeof metadata === "object" && !Array.isArray(metadata)
              ? metadata
              : {},
        },
      ],
    });

    return NextResponse.json({ ok: true, data: result.insertedEvents[0] ?? null });
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
