import { openai } from '@/lib/openai';

type DrillOptionResult = {
  correct_answer: string;
  distractors: string[];
};

function extractJsonObject(text: string): DrillOptionResult {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }

  return JSON.parse(text.slice(start, end + 1));
}

export async function generateVocabularyDrillOptions(input: {
  itemText: string;
  itemType: 'word' | 'phrase';
  plainEnglishMeaning: string;
}) {
  const prompt = `
You are creating vocabulary drill answer choices.

Task:
Return one correct answer and exactly 3 plausible distractors.

Rules:
- correct_answer must match the meaning
- distractors must be plausible but wrong
- short answers only
- return ONLY valid JSON object

Input item:
${input.itemText}

Item type:
${input.itemType}

Meaning:
${input.plainEnglishMeaning}

JSON shape:
{
  "correct_answer": "string",
  "distractors": ["string", "string", "string"]
}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}
