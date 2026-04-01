import { openai } from '@/lib/openai';
import { shuffleQuestionOptions } from '@/services/ai/shuffle-question-options';

type GeneratedQuestion = {
  question_type: 'main_idea' | 'detail' | 'inference' | 'vocabulary' | 'tone';
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  difficulty: number;
};

function extractJsonObject(text: string): GeneratedQuestion {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return a JSON object');
  }

  const raw = text.slice(start, end + 1);
  const parsed = JSON.parse(raw);

  if (!parsed || Array.isArray(parsed)) {
    throw new Error('Parsed result is not an object');
  }

  return parsed;
}

function validateQuestion(item: GeneratedQuestion) {
  if (
    !item.question_type ||
    !item.question_text ||
    !item.option_a ||
    !item.option_b ||
    !item.option_c ||
    !item.option_d ||
    !item.correct_option
  ) {
    throw new Error('Question has missing fields');
  }

  if (!['A', 'B', 'C', 'D'].includes(item.correct_option)) {
    throw new Error('Invalid correct_option');
  }

  if (typeof item.difficulty !== 'number') {
    throw new Error('Invalid difficulty');
  }
}

export async function regenerateSatQuestionWithFeedback(input: {
  passageTitle?: string | null;
  passageText: string;
  originalQuestion: {
    question_type: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    explanation?: string | null;
    difficulty?: number | null;
  };
  feedback: string;
}) {
  const prompt = `
You are an elite SAT Reading question writer and reviewer.

Task:
Regenerate exactly 1 SAT-style multiple-choice question for the same passage.

Rules:
- Keep the same question_type as the original question.
- Improve the question according to the editor feedback.
- The question must be answerable from the passage alone.
- Wrong answers must be plausible.
- Exactly one answer must be correct.
- Keep explanation short and precise.
- Difficulty must be an integer from 1 to 5.
- Return ONLY valid JSON object. No markdown. No commentary.

Passage title:
${input.passageTitle ?? 'Untitled'}

Passage:
${input.passageText}

Original question:
${JSON.stringify(input.originalQuestion, null, 2)}

Editor feedback:
${input.feedback}

JSON shape:
{
  "question_type": "main_idea",
  "question_text": "string",
  "option_a": "string",
  "option_b": "string",
  "option_c": "string",
  "option_d": "string",
  "correct_option": "A",
  "explanation": "string",
  "difficulty": 3
}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  const text = response.output_text;
  const question = extractJsonObject(text);
  validateQuestion(question);

  return shuffleQuestionOptions(question);
}
