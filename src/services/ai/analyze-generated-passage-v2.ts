import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";

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
- assessment = rich enough for 3 reading questions plus 1 vocabulary-in-context question
- context = useful for continuity, but only 1-3 light questions
- bridge = should usually have no reading questions
- recommended_vocab_questions_count should usually be 1
- target words/phrases must come from or clearly fit the passage
- question types can include:
  main_idea, central_claim, detail, inference, command_of_evidence, function,
  text_structure, tone, cause_effect, summary, vocabulary_in_context

Chapter:
${input.chapterTitle ?? 'Unknown chapter'}

Passage title:
${input.title ?? 'Untitled'}

Passage:
${input.passageText}
`;

  const response = await createTrackedResponse({
    route: "admin.analyze_generated_passage_v2",
    model: AI_MODELS.offlineQuality,
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}
