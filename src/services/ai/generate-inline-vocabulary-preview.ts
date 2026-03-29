import { openai } from '@/lib/openai';

type InlinePreview = {
  item_text: string;
  item_type: 'word' | 'phrase';
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
};

function extractJsonObject(text: string): InlinePreview {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }

  return JSON.parse(text.slice(start, end + 1));
}

export async function generateInlineVocabularyPreview(input: {
  nativeLanguage: string;
  passageText: string;
  itemText: string;
  itemType: 'word' | 'phrase';
}) {
  const languageMap: Record<string, string> = {
    ru: 'Russian',
    ro: 'Romanian',
    en: 'English',
  };

  const targetLanguage = languageMap[input.nativeLanguage] ?? 'Russian';

  const prompt = `
You are helping a student preview a vocabulary item before saving it.

Return ONLY valid JSON object with:
- item_text
- item_type
- plain_english_meaning
- translation
- context_meaning

Rules:
- plain_english_meaning must be short and simple
- translation must be in ${targetLanguage}
- context_meaning must explain the meaning in THIS passage
- return JSON only

Passage:
${input.passageText}

Item:
${input.itemText}

Item type:
${input.itemType}

JSON shape:
{
  "item_text": "string",
  "item_type": "word",
  "plain_english_meaning": "string",
  "translation": "string",
  "context_meaning": "string"
}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}
