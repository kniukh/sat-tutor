import { openai } from '@/lib/openai';

type GeneratedWritingPrompt = {
  prompt_text: string;
  prompt_type: 'short_answer';
};

function extractJsonObject(text: string): GeneratedWritingPrompt {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }

  return JSON.parse(text.slice(start, end + 1));
}

export async function generateWritingPromptFromPassage(input: {
  lessonName?: string | null;
  passageText: string;
}) {
  const prompt = `
You are an SAT reading tutor.

Create exactly 1 short-answer writing prompt for the passage.

Rules:
- The prompt must encourage textual understanding, not creative writing
- Good targets: main idea, author's purpose, tone, character change, inference
- Keep it short and clear
- Return ONLY valid JSON object

Lesson:
${input.lessonName ?? 'Untitled'}

Passage:
${input.passageText}

JSON shape:
{
  "prompt_text": "string",
  "prompt_type": "short_answer"
}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}