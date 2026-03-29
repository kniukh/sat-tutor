import { openai } from '@/lib/openai';

type PassageAnalysis = {
  passage_role: 'assessment' | 'context' | 'bridge';
  question_strategy: 'full_set' | 'light_check' | 'none';
  recommended_question_count: number;
  recommended_question_types: string[];
  analyzer_reason: string;
};

function extractJsonObject(text: string): PassageAnalysis {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function analyzeGeneratedPassage(input: {
  title?: string | null;
  passageText: string;
}) {
  const prompt = `
You are an expert SAT reading curriculum designer.

Analyze the passage and classify it for a full-book guided reading system.

Return ONLY valid JSON object with:
- passage_role: assessment | context | bridge
- question_strategy: full_set | light_check | none
- recommended_question_count: integer
- recommended_question_types: array of strings
- analyzer_reason: short explanation

Rules:
- assessment = rich enough for 3-5 meaningful SAT-style questions
- context = important for story continuity, but only 1-2 light questions
- bridge = should usually have no questions
- dialogue-heavy or low-analytic passages often become context or bridge

Passage title:
${input.title ?? 'Untitled'}

Passage:
${input.passageText}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}
