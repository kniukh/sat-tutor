import { openai } from '@/lib/openai';

type ShortAnswerFeedback = {
  overall_score: number;
  clarity: string;
  logic: string;
  completeness: string;
  strengths: string[];
  improvements: string[];
  concise_feedback: string;
};

function extractJsonObject(text: string): ShortAnswerFeedback {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }

  return JSON.parse(text.slice(start, end + 1));
}

export async function evaluateShortAnswer(input: {
  passageText: string;
  promptText: string;
  studentResponse: string;
}) {
  const prompt = `
You are an SAT reading tutor.

Evaluate a student's short written answer.

Return ONLY valid JSON with:
- overall_score: integer 1-5
- clarity: short feedback
- logic: short feedback
- completeness: short feedback
- strengths: array of short strings
- improvements: array of short strings
- concise_feedback: short paragraph

Rules:
- Be encouraging but honest
- Focus on reading comprehension and explanation quality
- Keep feedback brief and useful
- Do not use markdown

Passage:
${input.passageText}

Question:
${input.promptText}

Student response:
${input.studentResponse}

JSON shape:
{
  "overall_score": 4,
  "clarity": "string",
  "logic": "string",
  "completeness": "string",
  "strengths": ["string"],
  "improvements": ["string"],
  "concise_feedback": "string"
}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}
