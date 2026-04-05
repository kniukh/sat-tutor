import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";

export type MistakeType =
  | "careless_misread"
  | "vocab_gap"
  | "inference_failure"
  | "main_idea_confusion"
  | "evidence_selection_failure";

export type MistakeAnalysisInput = {
  question_id: string;
  question_type: string | null;
  question_text: string;
  selected_option: string | null;
  correct_option: string | null;
  explanation: string | null;
  passage_text: string;
  time_spent_ms: number | null;
};

export type MistakeAnalysisResult = {
  question_id: string;
  mistake_type: MistakeType;
  confidence: number;
  short_reason: string;
  coaching_tip: string;
};

const allowedMistakeTypes = new Set<MistakeType>([
  "careless_misread",
  "vocab_gap",
  "inference_failure",
  "main_idea_confusion",
  "evidence_selection_failure",
]);

function extractJsonArray(text: string): MistakeAnalysisResult[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON array");
  }

  const parsed = JSON.parse(text.slice(start, end + 1));

  if (!Array.isArray(parsed)) {
    throw new Error("Parsed result is not an array");
  }

  return parsed;
}

function validateResults(
  inputItems: MistakeAnalysisInput[],
  items: MistakeAnalysisResult[]
) {
  const inputIds = new Set(inputItems.map((item) => item.question_id));

  for (const item of items) {
    if (!inputIds.has(item.question_id)) {
      throw new Error(`Unknown question_id in result: ${item.question_id}`);
    }

    if (!allowedMistakeTypes.has(item.mistake_type)) {
      throw new Error(`Invalid mistake_type: ${item.mistake_type}`);
    }

    if (typeof item.confidence !== "number") {
      throw new Error("confidence must be a number");
    }

    if (!item.short_reason || !item.coaching_tip) {
      throw new Error("Result has missing explanation fields");
    }
  }
}

export async function analyzeLessonMistakes(input: {
  studentId?: string | null;
  wrongAnswers: MistakeAnalysisInput[];
}) {
  if (input.wrongAnswers.length === 0) {
    return [];
  }

  const prompt = `You are analyzing student reading mistakes after a lesson.

Classify each wrong answer into exactly one mistake_type from:
- careless_misread
- vocab_gap
- inference_failure
- main_idea_confusion
- evidence_selection_failure

Return STRICT JSON only as an array.

Rules:
- one object per question
- preserve question_id exactly
- confidence must be a number from 0 to 1
- short_reason must be brief and concrete
- coaching_tip must be short and actionable
- do not include markdown
- do not add extra keys

JSON shape:
[
  {
    "question_id": "uuid",
    "mistake_type": "careless_misread",
    "confidence": 0.84,
    "short_reason": "string",
    "coaching_tip": "string"
  }
]

Wrong answers to analyze:
${JSON.stringify(input.wrongAnswers, null, 2)}`;

  const response = await createTrackedResponse({
    route: "lesson.analyze_mistakes",
    model: AI_MODELS.liveReasoning,
    studentId: input.studentId ?? null,
    input: prompt,
  });

  const results = extractJsonArray(response.output_text);
  validateResults(input.wrongAnswers, results);

  return results;
}
