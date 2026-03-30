import { openai } from "@/lib/openai";
import type {
  VocabularyDrillAnswerSetKey,
  VocabularyDrillAnswerSetMap,
} from "@/types/vocabulary-answer-sets";

type RawVocabularyDrillAnswerSet = {
  drill_correct_answer: string;
  distractors: string[];
};

type RawVocabularyDrillAnswerSetMap = Partial<
  Record<VocabularyDrillAnswerSetKey, RawVocabularyDrillAnswerSet>
>;

function extractJsonObject(text: string): RawVocabularyDrillAnswerSetMap {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON object");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function sanitizeRawAnswerSetMap(
  value: RawVocabularyDrillAnswerSetMap
): RawVocabularyDrillAnswerSetMap {
  const result: RawVocabularyDrillAnswerSetMap = {};

  for (const [key, answerSet] of Object.entries(value)) {
    if (
      !answerSet ||
      typeof answerSet.drill_correct_answer !== "string" ||
      !Array.isArray(answerSet.distractors)
    ) {
      continue;
    }

    result[key as VocabularyDrillAnswerSetKey] = {
      drill_correct_answer: answerSet.drill_correct_answer,
      distractors: answerSet.distractors.filter(
        (candidate): candidate is string => typeof candidate === "string"
      ),
    };
  }

  return result;
}

export async function generateVocabularyDrillAnswerSets(input: {
  itemText: string;
  itemType: "word" | "phrase";
  englishExplanation: string;
  translatedExplanation?: string | null;
  contextSentence?: string | null;
  exampleText?: string | null;
  meaningFallbackPool?: string[];
  translationFallbackPool?: string[];
  lexicalFallbackPool?: string[];
  existingAnswerSets?: VocabularyDrillAnswerSetMap | null;
}) {
  const prompt = `
You are creating answer sets for SAT-style vocabulary drills.

Return JSON only.

Target word or phrase:
${input.itemText}

Item type:
${input.itemType}

Flashcard definition:
${input.englishExplanation}

Flashcard translation:
${input.translatedExplanation ?? "N/A"}

Context sentence:
${input.contextSentence ?? "N/A"}

Example text:
${input.exampleText ?? "N/A"}

Meaning fallback pool:
${JSON.stringify(input.meaningFallbackPool ?? [], null, 2)}

Translation fallback pool:
${JSON.stringify(input.translationFallbackPool ?? [], null, 2)}

Lexical fallback pool:
${JSON.stringify(input.lexicalFallbackPool ?? [], null, 2)}

Existing answer sets to improve if useful:
${JSON.stringify(input.existingAnswerSets ?? {}, null, 2)}

Rules:
- Each answer set must include exactly 1 drill_correct_answer and exactly 4 distractors.
- Distractors must be plausible but wrong.
- Keep distractors visually similar to the drill_correct_answer: similar length, same part of speech, similar difficulty, similar style.
- Avoid trivial opposites, jokey answers, generic fillers, and obvious mismatches.
- For synonym and context_meaning, do NOT copy the flashcard definition wording verbatim for the drill_correct_answer. Paraphrase it into a clean, student-facing answer choice.
- Distractors must not simply reuse the flashcard definition wording.
- For translation_native_to_english and collocation, use English words or phrases that match the target item's part of speech and shape.
- For collocation, the drill_correct_answer should be the actual target word or phrase, and distractors should still look plausible in the sentence without becoming correct.
- Short answer choices only. No explanations.

Return this exact JSON shape:
{
  "translation_english_to_native": {
    "drill_correct_answer": "string",
    "distractors": ["string", "string", "string", "string"]
  },
  "translation_native_to_english": {
    "drill_correct_answer": "string",
    "distractors": ["string", "string", "string", "string"]
  },
  "synonym": {
    "drill_correct_answer": "string",
    "distractors": ["string", "string", "string", "string"]
  },
  "context_meaning": {
    "drill_correct_answer": "string",
    "distractors": ["string", "string", "string", "string"]
  },
  "collocation": {
    "drill_correct_answer": "string",
    "distractors": ["string", "string", "string", "string"]
  }
}
`;

  const response = await openai.responses.create({
    model: "gpt-5",
    input: prompt,
  });

  return sanitizeRawAnswerSetMap(extractJsonObject(response.output_text));
}
