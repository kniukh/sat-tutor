import { runAiGenerationWithRetry } from "@/services/ai/ai-generation-retry";
import { shuffleQuestionOptions } from "@/services/ai/shuffle-question-options";
import { renderAdminQuestionPromptRouter } from "@/services/ai/admin-question-prompt-router";
import { normalizeAndValidateQuestionAnswers } from "@/services/ai/question-quality";

export type LessonGenerationQuestion = {
  question_type: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: number;
};

export type ChunkLessonPackage = {
  passage_role: "assessment" | "context" | "bridge";
  question_strategy: "full_set" | "light_check" | "none";
  recommended_question_count: number;
  recommended_question_types: string[];
  analyzer_reason: string;
  analysis_main_idea: string;
  analysis_structure: string;
  analysis_inference_points: string[];
  difficulty_level: "easy" | "medium" | "hard";
  text_mode: "narrative" | "dialogue" | "descriptive" | "analytical";
  vocab_density: "low" | "medium" | "high";
  phrase_density: "low" | "medium" | "high";
  writing_prompt_worthy: boolean;
  recommended_vocab_questions_count: number;
  recommended_vocab_target_words: string[];
  recommended_vocab_target_phrases: string[];
  sat_questions: LessonGenerationQuestion[];
  vocab_questions: LessonGenerationQuestion[];
};

export type ChunkLessonAnalysis = Omit<ChunkLessonPackage, "sat_questions" | "vocab_questions">;

function extractJsonObject(text: string): ChunkLessonPackage {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeInferencePointArray(value: unknown, fallback: string) {
  const points = normalizeStringArray(value).slice(0, 4);

  if (points.length >= 2) {
    return points;
  }

  if (points.length === 1) {
    return [points[0], fallback];
  }

  return [fallback, "The student should compare the evidence carefully before choosing the best answer."];
}

function normalizeSatQuestionType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized.includes("main")) {
    return "main_idea";
  }

  if (normalized.includes("detail")) {
    return "detail";
  }

  if (normalized.includes("tone")) {
    return "tone";
  }

  return "inference";
}

function normalizeVocabQuestionType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized.includes("translation")) {
    return "vocabulary_translation";
  }

  if (normalized.includes("definition")) {
    return "vocabulary_definition";
  }

  return "vocabulary_in_context";
}

function normalizeQuestion(
  item: Record<string, unknown>,
  bucket: "sat" | "vocab"
): LessonGenerationQuestion {
  const question_type =
    bucket === "sat"
      ? normalizeSatQuestionType(String(item.question_type ?? "inference"))
      : normalizeVocabQuestionType(String(item.question_type ?? "vocabulary_in_context"));

  const question: LessonGenerationQuestion = {
    question_type,
    question_text: String(item.question_text ?? "").trim(),
    option_a: String(item.option_a ?? "").trim(),
    option_b: String(item.option_b ?? "").trim(),
    option_c: String(item.option_c ?? "").trim(),
    option_d: String(item.option_d ?? "").trim(),
    correct_option: String(item.correct_option ?? "").trim().toUpperCase() as
      | "A"
      | "B"
      | "C"
      | "D",
    explanation: String(item.explanation ?? "").trim(),
    difficulty: Number(item.difficulty ?? 3),
  };

  if (
    !question.question_text ||
    !question.option_a ||
    !question.option_b ||
    !question.option_c ||
    !question.option_d ||
    !["A", "B", "C", "D"].includes(question.correct_option)
  ) {
    throw new Error(`Generated ${bucket} question has missing fields`);
  }

  if (!Number.isFinite(question.difficulty)) {
    throw new Error(`Generated ${bucket} question has invalid difficulty`);
  }

  const normalizedQuestion = normalizeAndValidateQuestionAnswers(
    {
      ...question,
      difficulty: Math.min(Math.max(Math.round(question.difficulty), 1), 5),
      explanation:
        question.explanation ||
        (bucket === "sat"
          ? "This answer best matches the passage when you follow the author's meaning closely."
          : "This choice matches the word's meaning in this specific passage context."),
    },
    {
      label: `${bucket} question`,
      semanticMode: bucket === "sat" ? "reading" : "vocabulary",
      minPlausibleDistractors: 2,
    }
  );

  return shuffleQuestionOptions({
    ...normalizedQuestion,
  });
}

function validatePackageShape(pkg: ChunkLessonPackage) {
  if (!pkg || Array.isArray(pkg)) {
    throw new Error("Lesson package is not an object");
  }

  if (!["assessment", "context", "bridge"].includes(pkg.passage_role)) {
    throw new Error("Invalid passage_role");
  }

  if (!["full_set", "light_check", "none"].includes(pkg.question_strategy)) {
    throw new Error("Invalid question_strategy");
  }

  if (!["easy", "medium", "hard"].includes(pkg.difficulty_level)) {
    throw new Error("Invalid difficulty_level");
  }

  if (!["narrative", "dialogue", "descriptive", "analytical"].includes(pkg.text_mode)) {
    throw new Error("Invalid text_mode");
  }

  if (!["low", "medium", "high"].includes(pkg.vocab_density)) {
    throw new Error("Invalid vocab_density");
  }

  if (!["low", "medium", "high"].includes(pkg.phrase_density)) {
    throw new Error("Invalid phrase_density");
  }

  if (!Array.isArray(pkg.sat_questions) || pkg.sat_questions.length < 2) {
    throw new Error("Expected 2 SAT questions");
  }

  if (!Array.isArray(pkg.vocab_questions) || pkg.vocab_questions.length < 2) {
    throw new Error("Expected 2 vocabulary questions");
  }
}

export async function generateChunkLessonPackage(input: {
  title?: string | null;
  chapterTitle?: string | null;
  passageText: string;
  sourceType?: string | null;
  cachedAnalysis?: ChunkLessonAnalysis | null;
}) {
  const sourceType = (input.sourceType ?? "book").toLowerCase();
  const contentMode =
    sourceType === "poem" ? "poem" : sourceType === "article" || sourceType === "essay" ? "article" : "book";

  const literaryGuidance =
    contentMode === "poem"
      ? `
For SAT questions, keep them literary:
- focus on interpretation, meaning, tone, and imagery
- avoid trivial factual questions
- still map question_type to one of: main_idea, detail, inference, tone
`
      : `
For SAT questions, use classic passage-based reading skills:
- main idea
- detail
- inference
- tone when it fits naturally
`;

  const cachedAnalysisBlock = input.cachedAnalysis
    ? `
Verified cached chunk analysis:
- passage_role: ${input.cachedAnalysis.passage_role}
- question_strategy: ${input.cachedAnalysis.question_strategy}
- recommended_question_count: ${input.cachedAnalysis.recommended_question_count}
- recommended_question_types: ${input.cachedAnalysis.recommended_question_types.join(", ") || "main_idea, detail, inference, vocabulary_in_context"}
- analyzer_reason: ${input.cachedAnalysis.analyzer_reason}
- analysis_main_idea: ${input.cachedAnalysis.analysis_main_idea}
- analysis_structure: ${input.cachedAnalysis.analysis_structure}
- analysis_inference_points: ${JSON.stringify(input.cachedAnalysis.analysis_inference_points)}
- difficulty_level: ${input.cachedAnalysis.difficulty_level}
- text_mode: ${input.cachedAnalysis.text_mode}
- vocab_density: ${input.cachedAnalysis.vocab_density}
- phrase_density: ${input.cachedAnalysis.phrase_density}
- writing_prompt_worthy: ${String(input.cachedAnalysis.writing_prompt_worthy)}
- recommended_vocab_questions_count: ${input.cachedAnalysis.recommended_vocab_questions_count}
- recommended_vocab_target_words: ${JSON.stringify(input.cachedAnalysis.recommended_vocab_target_words)}
- recommended_vocab_target_phrases: ${JSON.stringify(input.cachedAnalysis.recommended_vocab_target_phrases)}

Use this cached analysis as the source of truth for the chunk.
Do not spend tokens re-analyzing the chunk from scratch.
Keep these analysis fields unchanged in the final JSON unless a field would otherwise be empty.
`
    : "";

  const prompt = `
You are an expert SAT curriculum designer building a lesson package from one clean reading chunk.

Task:
In ONE pass, analyze the chunk and generate:
- analysis metadata
- exactly 2 SAT-style reading questions
- exactly 2 vocabulary questions

The chunk text is already clean and approved by a human editor.
Do not ask for more cleanup.

Unified prompt router:
${renderAdminQuestionPromptRouter({
  routeIds: [
    "main_idea",
    "detail",
    "inference",
    "tone",
    "vocabulary_in_context",
    "definition",
    "translation",
  ],
})} 

${cachedAnalysisBlock}

Global rules:
- Return ONLY valid JSON object.
- No markdown.
- No commentary outside the JSON.
- Keep all questions answerable from the chunk alone.
- Questions should feel College Board-level: reasoning-heavy, precise, and resistant to keyword matching.
- Every question must have exactly 4 options.
- Exactly 1 option must be correct.
- Distractors must be plausible and similar in length, tone, and structure to the correct answer.
- Answers must work as "best answer" choices, not merely technically true statements.
- Explanations must be short, practical, and useful for later review.
- Difficulty must be an integer from 1 to 5.
- ${
    input.cachedAnalysis
      ? "Use the cached passage analysis below to decide what to ask. Do not redo the analysis unless a field is missing."
      : `Before writing questions, do a passage analysis pass:
  - identify the main idea
  - map the chunk structure
  - list at least 2 inference points the student must reason through
Use that analysis to decide what to ask. Do not write recall-only questions.`
  }
- Run an internal quality check before finalizing:
  - no obvious elimination by tone or length
  - at least 2 answer choices should remain plausible on a careful read
  - if an answer can be chosen by keyword matching alone, rewrite the question

Analysis rules:
- passage_role: assessment | context | bridge
- question_strategy: full_set | light_check | none
- recommended_question_count: integer
- recommended_question_types: string[]
- analyzer_reason: short explanation
- analysis_main_idea: one concise sentence
- analysis_structure: one concise sentence describing how the chunk develops
- analysis_inference_points: string[]
- difficulty_level: easy | medium | hard
- text_mode: narrative | dialogue | descriptive | analytical
- vocab_density: low | medium | high
- phrase_density: low | medium | high
- writing_prompt_worthy: boolean
- recommended_vocab_questions_count: integer
- recommended_vocab_target_words: string[]
- recommended_vocab_target_phrases: string[]

SAT question rules:
${literaryGuidance}
- Generate exactly 2 SAT questions.
- Use only question_type values: main_idea, detail, inference, tone.
- For each SAT question_type you choose, follow the matching route from the unified prompt router.
- Make the correct answer require real understanding, not keyword spotting.
- Wrong answers should reflect realistic student traps such as too broad, too narrow, misinterpretation, or keyword trap when they fit.
- Prefer questions that require weighing the best answer rather than recalling a phrase.

Vocabulary question rules:
- Generate exactly 2 vocabulary questions.
- Choose useful non-trivial words or short phrases that appear in the chunk.
- One question must test meaning in context.
- The second must test definition or translation.
- Use question_type values:
  - vocabulary_in_context
  - vocabulary_definition
  - vocabulary_translation
- For each vocabulary question_type you choose, follow the matching route from the unified prompt router.
- Base the correct answer on this context, not just a generic dictionary meaning.
- Do not use random or obviously wrong distractors.
- Make answer choices close enough that the student must really understand the contextual meaning.

JSON shape:
{
  "passage_role": "assessment",
  "question_strategy": "full_set",
  "recommended_question_count": 4,
  "recommended_question_types": ["main_idea", "detail", "inference", "vocabulary_in_context"],
  "analyzer_reason": "string",
  "analysis_main_idea": "string",
  "analysis_structure": "string",
  "analysis_inference_points": ["string", "string"],
  "difficulty_level": "medium",
  "text_mode": "narrative",
  "vocab_density": "medium",
  "phrase_density": "low",
  "writing_prompt_worthy": false,
  "recommended_vocab_questions_count": 2,
  "recommended_vocab_target_words": ["string"],
  "recommended_vocab_target_phrases": ["string"],
  "sat_questions": [
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
  ],
  "vocab_questions": [
    {
      "question_type": "vocabulary_in_context",
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
}

Content kind:
${contentMode}

Chapter:
${input.chapterTitle ?? "Unknown chapter"}

Passage title:
${input.title ?? "Untitled"}

Chunk:
${input.passageText}
`;

  const parsed = await runAiGenerationWithRetry({
    label: "chunk lesson package generation",
    prompt,
    parseAndValidate: (text) => {
      const next = extractJsonObject(text);
      validatePackageShape(next);
      return next;
    },
  });

  return {
    ...parsed,
    recommended_question_count: input.cachedAnalysis
      ? input.cachedAnalysis.recommended_question_count
      : Math.max(0, Math.round(Number(parsed.recommended_question_count ?? 4))),
    recommended_question_types: input.cachedAnalysis
      ? input.cachedAnalysis.recommended_question_types
      : normalizeStringArray(parsed.recommended_question_types),
    analyzer_reason: input.cachedAnalysis
      ? input.cachedAnalysis.analyzer_reason
      : String(parsed.analyzer_reason ?? "").trim(),
    analysis_main_idea: input.cachedAnalysis
      ? input.cachedAnalysis.analysis_main_idea
      : String(parsed.analysis_main_idea ?? parsed.analyzer_reason ?? "").trim(),
    analysis_structure: input.cachedAnalysis
      ? input.cachedAnalysis.analysis_structure
      : String(parsed.analysis_structure ?? "The chunk develops one idea through connected evidence.").trim(),
    analysis_inference_points: input.cachedAnalysis
      ? input.cachedAnalysis.analysis_inference_points
      : normalizeInferencePointArray(
          parsed.analysis_inference_points,
          String(parsed.analyzer_reason ?? "The student should track the passage logic, not just isolated words.").trim()
        ),
    passage_role: input.cachedAnalysis?.passage_role ?? parsed.passage_role,
    question_strategy: input.cachedAnalysis?.question_strategy ?? parsed.question_strategy,
    difficulty_level: input.cachedAnalysis?.difficulty_level ?? parsed.difficulty_level,
    text_mode: input.cachedAnalysis?.text_mode ?? parsed.text_mode,
    vocab_density: input.cachedAnalysis?.vocab_density ?? parsed.vocab_density,
    phrase_density: input.cachedAnalysis?.phrase_density ?? parsed.phrase_density,
    writing_prompt_worthy: input.cachedAnalysis?.writing_prompt_worthy ?? parsed.writing_prompt_worthy,
    recommended_vocab_questions_count: input.cachedAnalysis
      ? input.cachedAnalysis.recommended_vocab_questions_count
      : Math.max(0, Math.round(Number(parsed.recommended_vocab_questions_count ?? 2))),
    recommended_vocab_target_words: input.cachedAnalysis
      ? input.cachedAnalysis.recommended_vocab_target_words
      : normalizeStringArray(parsed.recommended_vocab_target_words),
    recommended_vocab_target_phrases: input.cachedAnalysis
      ? input.cachedAnalysis.recommended_vocab_target_phrases
      : normalizeStringArray(parsed.recommended_vocab_target_phrases),
    sat_questions: parsed.sat_questions.slice(0, 2).map((item) => normalizeQuestion(item as Record<string, unknown>, "sat")),
    vocab_questions: parsed.vocab_questions
      .slice(0, 2)
      .map((item) => normalizeQuestion(item as Record<string, unknown>, "vocab")),
  } satisfies ChunkLessonPackage;
}
