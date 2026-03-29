import { openai } from '@/lib/openai';

type PassageAnalysisV2 = {
  passage_role: 'assessment' | 'context' | 'bridge';
  question_strategy: 'full_set' | 'light_check' | 'none';
  recommended_question_count: number;
  recommended_question_types: string[];
  analyzer_reason: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  text_mode: 'narrative' | 'dialogue' | 'descriptive' | 'analytical';
  vocab_density: 'low' | 'medium' | 'high';
  phrase_density: 'low' | 'medium' | 'high';
  writing_prompt_worthy: boolean;
  recommended_vocab_questions_count: number;
  recommended_vocab_target_words: string[];
  recommended_vocab_target_phrases: string[];
};

function extractJsonObject(text: string): PassageAnalysisV2 {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function analyzeGeneratedPassageV2(input: {
  title?: string | null;
  chapterTitle?: string | null;
  passageText: string;
}) {
  const prompt = `
You are an expert SAT reading curriculum designer.

Analyze the passage for a full-book guided reading system.

Return ONLY valid JSON object with:
- passage_role: assessment | context | bridge
- question_strategy: full_set | light_check | none
- recommended_question_count: integer
- recommended_question_types: string[]
- analyzer_reason: short explanation
- difficulty_level: easy | medium | hard
- text_mode: narrative | dialogue | descriptive | analytical
- vocab_density: low | medium | high
- phrase_density: low | medium | high
- writing_prompt_worthy: boolean
- recommended_vocab_questions_count: integer
- recommended_vocab_target_words: string[]
- recommended_vocab_target_phrases: string[]

Rules:
- assessment = rich enough for 3-6 meaningful SAT-style questions
- context = useful for continuity, but only 1-3 light questions
- bridge = should usually have no reading questions
- if vocabulary is rich, increase recommended_vocab_questions_count
- target words/phrases must come from or clearly fit the passage
- prefer more vocabulary questions when lexical richness is high
- question types can include:
  main_idea, detail, inference, tone, vocab_in_context, phrase_meaning, contextual_paraphrase

Chapter:
${input.chapterTitle ?? 'Unknown chapter'}

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
