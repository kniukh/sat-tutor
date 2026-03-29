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
  contextSentence?: string | null;
  exampleText?: string | null;
  existingDistractors?: string[];
  fallbackPool?: string[];
}) {
  const prompt = `
You are creating vocabulary drill answer choices.

Task:
Return one correct answer and exactly 4 plausible distractors.

Rules:
- correct_answer must match the meaning
- distractors must be plausible but wrong
- distractors should match the same part of speech or answer style as the correct answer
- distractors should be close in difficulty and tone to the correct answer
- distractors should be semantically nearby enough to feel plausible in SAT practice
- avoid obvious antonyms, joke answers, trivia, and overly broad words like "thing" or "good"
- if context is available, make distractors still plausible in context without becoming correct
- short answers only
- return ONLY valid JSON object

Input item:
${input.itemText}

Item type:
${input.itemType}

Meaning:
${input.plainEnglishMeaning}

Context sentence:
${input.contextSentence ?? "N/A"}

Example text:
${input.exampleText ?? "N/A"}

Existing distractors to improve if useful:
${JSON.stringify(input.existingDistractors ?? [], null, 2)}

Fallback meaning pool if useful:
${JSON.stringify(input.fallbackPool ?? [], null, 2)}

JSON shape:
{
  "correct_answer": "string",
  "distractors": ["string", "string", "string", "string"]
}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}
