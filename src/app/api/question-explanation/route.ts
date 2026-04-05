import { NextResponse } from "next/server";
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import {
  buildFallbackQuestionReasoningExplanation,
  generateQuestionReasoningExplanation,
} from "@/services/ai/generate-question-reasoning-explanation";

type Choice = {
  option: "A" | "B" | "C" | "D";
  text: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      passageText,
      questionText,
      options,
      correctOption,
      questionExplanation,
    }: {
      passageText: string;
      questionText: string;
      options: Choice[];
      correctOption: "A" | "B" | "C" | "D";
      questionExplanation?: string | null;
    } = body;

    if (
      !passageText?.trim() ||
      !questionText?.trim() ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      !correctOption
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const sessionStudentId = await requireStudentApiStudentId();

    try {
      const explanation = await generateQuestionReasoningExplanation({
        passageText: passageText.trim(),
        questionText: questionText.trim(),
        options,
        correctOption,
        questionExplanation: questionExplanation ?? null,
        studentId: sessionStudentId,
      });

      return NextResponse.json({ ok: true, data: explanation });
    } catch (error) {
      console.warn("POST /api/question-explanation fallback", error);

      const fallback = buildFallbackQuestionReasoningExplanation({
        questionText: questionText.trim(),
        options,
        correctOption,
        questionExplanation: questionExplanation ?? null,
      });

      return NextResponse.json({ ok: true, data: fallback });
    }
  } catch (error: any) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("POST /api/question-explanation error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
