import { openai } from "@/lib/openai";
import { generateInlineVocabularyPreview } from "@/services/ai/generate-inline-vocabulary-preview";

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

const VOCAB_CARD_TIMEOUT_MS = 20000;

function normalizeKey(text: string) {
  return text.trim().toLowerCase();
}

function extractJsonPayload(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

function buildFallbackCard(
  item: GenerateVocabularyCardsInput["items"][number]
): GeneratedVocabularyCard {
  const trimmedItem = item.item_text.trim();
  const exampleText =
    item.context_text?.trim() ||
    `Pay attention to how "${trimmedItem}" is used in this passage.`;

  return {
    item_text: trimmedItem,
    english_explanation: item.item_type === "phrase"
      ? "Meaning of this phrase in the passage."
      : "Meaning of this word in the passage.",
    translated_explanation: trimmedItem,
    example_text: exampleText,
  };
}

function isPlaceholderCard(card: GeneratedVocabularyCard) {
  const english = card.english_explanation.trim().toLowerCase();
  const translated = card.translated_explanation.trim().toLowerCase();
  const itemKey = normalizeKey(card.item_text);

  return (
    !english ||
    english === "meaning of this word in the passage." ||
    english === "meaning of this phrase in the passage." ||
    english === `meaning of "${itemKey}"` ||
    english === `meaning of "${itemKey}" in the passage.` ||
    translated === itemKey
  );
}

function normalizeGeneratedCards(
  items: GenerateVocabularyCardsInput["items"],
  generated: GeneratedVocabularyCard[] | null | undefined
) {
  const generatedMap = new Map(
    (generated ?? [])
      .filter((item) => item?.item_text?.trim())
      .map((item) => [normalizeKey(item.item_text), item])
  );

  return items.map((item) => {
    const match = generatedMap.get(normalizeKey(item.item_text));
    const fallback = buildFallbackCard(item);

    return {
      item_text: item.item_text,
      english_explanation:
        match?.english_explanation?.trim() || fallback.english_explanation,
      translated_explanation:
        match?.translated_explanation?.trim() || fallback.translated_explanation,
      example_text: match?.example_text?.trim() || fallback.example_text,
    };
  });
}

async function enrichPlaceholderCards(params: {
  items: GenerateVocabularyCardsInput["items"];
  nativeLanguage: string;
  cards: GeneratedVocabularyCard[];
}) {
  const resolvedCards = [...params.cards];

  await Promise.all(
    params.items.map(async (item, index) => {
      const currentCard = resolvedCards[index];

      if (!currentCard || !isPlaceholderCard(currentCard)) {
        return;
      }

      const preview = await generateInlineVocabularyPreview({
        nativeLanguage: params.nativeLanguage,
        passageText: item.context_text?.trim() || item.item_text,
        itemText: item.item_text,
        itemType: item.item_type === "phrase" ? "phrase" : "word",
      });

      if (
        preview.plain_english_meaning &&
        preview.plain_english_meaning !== "Quick preview not ready yet."
      ) {
        resolvedCards[index] = {
          item_text: item.item_text,
          english_explanation: preview.plain_english_meaning.trim(),
          translated_explanation:
            preview.translation.trim() || currentCard.translated_explanation,
          example_text:
            item.context_text?.trim() ||
            preview.context_meaning.trim() ||
            currentCard.example_text,
        };
      }
    })
  );

  return resolvedCards;
}

export async function generateVocabularyCards({
  items,
  nativeLanguage,
}: GenerateVocabularyCardsInput): Promise<GeneratedVocabularyCard[]> {
  if (!items.length) return [];

  const promptItems = items.map((item) => ({
    item_text: item.item_text,
    item_type: item.item_type,
  }));

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
- Do not depend on passage context.
- Give the most common useful meaning for quick review.
- Keep each explanation short enough for a flashcard.
- No markdown.
- No extra text.

Items:
${JSON.stringify(promptItems, null, 2)}
`;

  try {
    const aiRequest = openai.responses
      .create({
        model: "gpt-5-mini",
        input: prompt,
      })
      .then((response) => {
        const text = response.output_text || "";
        const jsonPayload = extractJsonPayload(text);

        if (!jsonPayload) {
          return [];
        }

        const parsed = JSON.parse(jsonPayload) as { items: GeneratedVocabularyCard[] };
        return parsed.items ?? [];
      });

    const generated = await Promise.race<GeneratedVocabularyCard[] | null>([
      aiRequest,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), VOCAB_CARD_TIMEOUT_MS);
      }),
    ]);

    const normalizedCards = normalizeGeneratedCards(items, generated);
    return enrichPlaceholderCards({
      items,
      nativeLanguage,
      cards: normalizedCards,
    });
  } catch (error) {
    console.error("generateVocabularyCards fallback", error);
    const normalizedCards = normalizeGeneratedCards(items, null);
    return enrichPlaceholderCards({
      items,
      nativeLanguage,
      cards: normalizedCards,
    });
  }
}
