import { runAiGenerationWithRetry } from '@/services/ai/ai-generation-retry';
import {
  getAdminQuestionPromptRoute,
  renderAdminQuestionPromptRouter,
} from '@/services/ai/admin-question-prompt-router';
import type { ChunkLessonAnalysis } from '@/services/ai/generate-chunk-lesson-package';
import { normalizeAndValidateQuestionAnswers } from '@/services/ai/question-quality';
import { shuffleQuestionOptions } from '@/services/ai/shuffle-question-options';

type GeneratedQuestion = {
  question_type:
    | 'main_idea'
    | 'detail'
    | 'inference'
    | 'vocabulary'
    | 'tone'
    | 'vocabulary_in_context'
    | 'vocabulary_definition'
    | 'vocabulary_translation';
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

  normalizeAndValidateQuestionAnswers(item, {
    label: `${item.question_type} regenerated question`,
    semanticMode: item.question_type.startsWith('vocabulary') ? 'vocabulary' : 'reading',
    minPlausibleDistractors: 2,
  });
}

export async function regenerateSatQuestionWithFeedback(input: {
  passageTitle?: string | null;
  passageText: string;
  passageExcerpt?: string | null;
  cachedAnalysis?: ChunkLessonAnalysis | null;
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
  const route = getAdminQuestionPromptRoute(input.originalQuestion.question_type);
  const effectivePassageText = input.passageExcerpt?.trim() || input.passageText;
  const cachedAnalysisBlock = input.cachedAnalysis
    ? `
Cached chunk analysis:
- main idea: ${input.cachedAnalysis.analysis_main_idea}
- structure: ${input.cachedAnalysis.analysis_structure}
- inference points: ${JSON.stringify(input.cachedAnalysis.analysis_inference_points)}
- passage role: ${input.cachedAnalysis.passage_role}
- question strategy: ${input.cachedAnalysis.question_strategy}

Use this analysis as the source of truth.
`
    : "";
  const prompt = `
You are an elite SAT Reading question writer and reviewer.

Task:
Regenerate exactly 1 SAT-style multiple-choice question for the same passage.

Unified prompt router:
${renderAdminQuestionPromptRouter({
  routeIds: [input.originalQuestion.question_type],
})}

${cachedAnalysisBlock}

Rules:
- Keep the same question_type as the original question.
- Improve the question according to the editor feedback.
- The question must be answerable from the provided passage excerpt alone.
- Work only from the excerpt and cached analysis below. Do not reconstruct a longer passage context.
- Wrong answers must be plausible and trap-based.
- Follow the matching route from the unified prompt router for distractor logic and answer balance.
- Exactly one answer must be correct.
- Make the correct answer the best answer, not simply a technically true one.
- Normalize the answer set so the options are similar in length, tone, and structure.
- Run a final quality check:
  - no obvious elimination by tone or length
  - at least 2 plausible options on a close reread
  - if the answer can be found by keyword matching alone, rewrite it
- Keep explanation short and precise.
- Difficulty must be an integer from 1 to 5.
- Return ONLY valid JSON object. No markdown. No commentary.

Passage title:
${input.passageTitle ?? 'Untitled'}

Relevant passage excerpt:
${effectivePassageText}

Original question:
${JSON.stringify(input.originalQuestion, null, 2)}

Resolved route:
${route.id}

Route goal:
${route.goal}

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

  const question = await runAiGenerationWithRetry({
    label: 'sat question regeneration',
    prompt,
    parseAndValidate: (text) => {
      const next = extractJsonObject(text);
      validateQuestion(next);
      return next;
    },
  });

  return shuffleQuestionOptions(
    normalizeAndValidateQuestionAnswers(question, {
      label: `${question.question_type} regenerated question`,
      semanticMode: question.question_type.startsWith('vocabulary') ? 'vocabulary' : 'reading',
      minPlausibleDistractors: 2,
    })
  );
}
