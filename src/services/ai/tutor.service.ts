import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";

export async function generateTutorExplanation(input: {
  passageText: string;
  selectedText: string;
  studentId?: string | null;
}) {
  const response = await createTrackedResponse({
    route: "ai.tutor_explanation",
    model: AI_MODELS.liveTutor,
    studentId: input.studentId ?? null,
    input: `You are a reading tutor for a student.

Give a short, clear explanation of the selected text in simple English.
Focus on what it means in the passage.
Keep the answer under 90 words.

Passage:
${input.passageText}

Selected text:
${input.selectedText}`,
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("AI tutor returned empty output");
  }

  return text;
}
