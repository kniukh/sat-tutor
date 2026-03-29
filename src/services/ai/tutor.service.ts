import { openai } from "@/lib/openai";

export async function generateTutorExplanation(input: {
  passageText: string;
  selectedText: string;
}) {
  const response = await openai.responses.create({
    model: "gpt-4o-mini",
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
