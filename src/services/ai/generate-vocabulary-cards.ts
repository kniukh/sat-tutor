import { openai } from "@/lib/openai";

type GenerateVocabularyCardsInput = {
  items: Array<{
    item_text: string;
    item_type: string;
    context_text?: string | null;
  }>;
  nativeLanguage: string;
};

type GeneratedVocabularyCard = {
  item_text: string;
  english_explanation: string;
  translated_explanation: string;
  example_text: string;
};

export async function generateVocabularyCards({
  items,
  nativeLanguage,
}: GenerateVocabularyCardsInput): Promise<GeneratedVocabularyCard[]> {
  if (!items.length) return [];

  const prompt = `
You are creating vocabulary cards for an SAT reading student.

Return strict JSON only in this format:
{
  "items": [
    {
      "item_text": "string",
      "english_explanation": "short simple English meaning",
      "translated_explanation": "translation in the student's native language",
      "example_text": "one short example sentence in English"
    }
  ]
}

Rules:
- Keep explanations short and clear.
- Use student-friendly English.
- Translation language: ${nativeLanguage}
- Preserve the original item_text exactly.
- If item is a phrase, explain the phrase meaning, not separate words.
- If context is available, use it.
- No markdown.
- No extra text.

Items:
${JSON.stringify(items, null, 2)}
`;

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: prompt,
  });

  const text =
    response.output_text ||
    "";

  const parsed = JSON.parse(text) as { items: GeneratedVocabularyCard[] };
  return parsed.items ?? [];
}