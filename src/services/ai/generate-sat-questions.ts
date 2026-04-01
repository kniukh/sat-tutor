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

function extractJson(text: string): GeneratedQuestion[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return a JSON array');
  }

  const raw = text.slice(start, end + 1);
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Parsed result is not an array');
  }

  return parsed;
}

function validateQuestions(items: GeneratedQuestion[]) {
  if (items.length === 0) {
    throw new Error('No questions generated');
  }

  for (const item of items) {
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
}

export async function generateSatQuestionsFromPassage(input: {
  title?: string | null;
  passageText: string;
  passageRole?: 'assessment' | 'context' | 'bridge' | null;
  questionStrategy?: 'full_set' | 'light_check' | 'none' | null;
  recommendedQuestionCount?: number | null;
  recommendedQuestionTypes?: string[] | null;
}) {
  const role = input.passageRole ?? 'assessment';
  const strategy = input.questionStrategy ?? 'full_set';
  const count = input.recommendedQuestionCount ?? 5;
  const types = input.recommendedQuestionTypes ?? [];

  if (role === 'bridge' || strategy === 'none' || count <= 0) {
    return [];
  }

  const modeInstructions =
    strategy === 'light_check'
      ? `
Create ${Math.min(Math.max(count, 1), 2)} light checkpoint questions.
These are for guided full-book reading, not full SAT assessment.
Prefer simpler comprehension/context questions.
Keep them shorter and lighter.
`
      : `
Create exactly ${Math.max(count, 1)} SAT-style multiple-choice questions.
These should feel like a proper assessment set.
`;

  const typeInstructions =
    types.length > 0
      ? `Preferred question types: ${types.join(', ')}. Follow these as closely as possible.`
      : `Use a balanced mix of main_idea, detail, inference, vocabulary, and tone when appropriate.`;

  const prompt = `
You are an elite SAT Reading curriculum designer.

Task:
Generate questions for the passage.

Requirements:
${modeInstructions}
${typeInstructions}
- Each question must have 4 answer options.
- Exactly one option must be correct.
- Wrong answers must be plausible.
- Questions must be answerable from the passage alone.
- Keep explanations short and precise.
- Difficulty should be an integer from 1 to 5.
- Return ONLY valid JSON array. No markdown. No commentary.

JSON shape:
[
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
]

Passage role:
${role}

Question strategy:
${strategy}

Passage title:
${input.title ?? 'Untitled'}

Passage:
${input.passageText}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  const text = response.output_text;
  const questions = extractJson(text);
  validateQuestions(questions);

  return questions.map((question) => shuffleQuestionOptions(question));
}
