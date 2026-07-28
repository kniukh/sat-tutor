import { AI_MODELS } from "@/services/ai/ai-models";
import { createTrackedResponse } from "@/services/ai/openai-tracked-response";
import {
  type VocabularyGoldContentField,
  type VocabularyGoldContentRecord,
  sanitizeVocabularyGoldContentRecord,
} from "@/services/vocabulary/vocabulary-gold-content-validation.service";

export const VOCABULARY_GOLD_CONTENT_PROMPT_VERSION = "vocab_gold_content_v1";
export const VOCABULARY_GOLD_CONTENT_REPAIR_PROMPT_VERSION = "vocab_gold_content_repair_v1";

export type VocabularyGoldContentGenerationItem = {
  word: string;
  itemType: "word" | "phrase";
  targetLanguage: string;
  partOfSpeechHint?: string | null;
  definitionHint?: string | null;
  translationHint?: string | null;
  exampleHint?: string | null;
  fields?: VocabularyGoldContentField[] | null;
};

type RawGoldContentItem = Partial<VocabularyGoldContentRecord> & {
  item_text?: string;
  word?: string;
};

type RawGoldContentRepairItem = {
  word?: string;
  fields?: Partial<VocabularyGoldContentRecord>;
};

const GOLD_CONTENT_SYSTEM_PROMPT = `You generate reusable vocabulary content for SAT Tutor.

Return strict JSON only:
{"items":[{"word":"string","part_of_speech":"noun|verb|adjective|adverb|phrase|unknown","core_meaning":"3-8 word English gloss","definition":"fuller student-friendly English definition","translation_word":"short natural translation of the word itself","translation_meaning":"translation of the English definition/meaning","synonyms":["short synonym"],"antonyms":["short antonym"],"example_sentence":"natural SAT-level English sentence using the word","example_translation":"translation of example_sentence","audio_text":"exact text to pronounce"}]}

Critical distinctions:
- translation_word is a very short lexical translation of the vocabulary word itself: ideally 1 word, maximum 2-3 words only when needed.
- translation_meaning is a translation of the definition/meaning. It can be longer.
- core_meaning is short. Do not copy a long definition into core_meaning.
- definition can be a fuller explanation, but still concise.
- audio_text defaults to the word unless pronunciation should omit extra punctuation.

Few-shot examples:
Input word: "prudent", target_language: "ru"
Good: translation_word="благоразумный", translation_meaning="проявляющий осторожность и здравый смысл", core_meaning="wise and careful"
Bad: translation_word="проявляющий осторожность и здравый смысл при принятии решений"

Input word: "charge", target_language: "ru"
Good for common SAT sense: translation_word="обвинение", translation_meaning="утверждение, что кто-то сделал что-то неправильное", core_meaning="formal accusation"
Bad: core_meaning="a formal accusation made when someone says another person did something wrong"

Input phrase: "fist-fight", target_language: "ru"
Good: translation_word="драка на кулаках", core_meaning="fight using fists", audio_text="fist-fight"

Rules:
- Preserve word exactly in the word field.
- Keep translation_word to 1 word whenever possible. Use 2-3 words only when a natural single-word translation does not exist.
- Never put a definition, explanation, or full phrase meaning in translation_word; put that in translation_meaning instead.
- translation_word and translation_meaning should not be identical unless truly unavoidable.
- example_sentence must contain the word or a clear inflected form.
- synonyms must not include the target word.
- antonyms are optional; return [] when no natural antonym exists.
- Prefer common academic/SAT-relevant senses, not rare archaic senses.
- No markdown. No comments. No extra text.`;

const GOLD_CONTENT_REPAIR_SYSTEM_PROMPT = `You repair only failing fields in reusable vocabulary content.

Return strict JSON only:
{"items":[{"word":"string","fields":{"field_name":"repaired value","synonyms":["..."],"antonyms":["..."]}}]}

Rules:
- Only include requested failing fields.
- Preserve the word exactly.
- Keep repaired values concise.
- translation_word is a very short lexical translation of the word itself: ideally 1 word, maximum 2-3 words only when needed.
- translation_meaning is a translation of the definition.
- example_sentence must contain the target word or a valid inflected form.
- audio_text should default to the word if no special pronunciation text is needed.
- No markdown. No extra text.`;

function normalizeKey(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }

  return JSON.parse(source.slice(start, end + 1)) as {
    items?: RawGoldContentItem[];
  };
}

function extractRepairJsonObject(text: string) {
  const parsed = extractJsonObject(text) as {
    items?: RawGoldContentRepairItem[];
  };

  return parsed.items ?? [];
}

function normalizeGeneratedItems(
  inputs: VocabularyGoldContentGenerationItem[],
  rawItems: RawGoldContentItem[]
) {
  const byKey = new Map(
    rawItems
      .filter((item) => typeof (item.word ?? item.item_text) === "string")
      .map((item) => [normalizeKey(String(item.word ?? item.item_text)), item])
  );

  return new Map(
    inputs.map((input) => {
      const raw = byKey.get(normalizeKey(input.word)) ?? {};
      return [
        normalizeKey(input.word),
        sanitizeVocabularyGoldContentRecord({
          word: input.word,
          part_of_speech: raw.part_of_speech ?? input.partOfSpeechHint ?? null,
          core_meaning: raw.core_meaning ?? null,
          definition: raw.definition ?? input.definitionHint ?? null,
          translation_word: raw.translation_word ?? null,
          translation_meaning: raw.translation_meaning ?? input.translationHint ?? null,
          synonyms: raw.synonyms ?? [],
          antonyms: raw.antonyms ?? [],
          example_sentence: raw.example_sentence ?? input.exampleHint ?? null,
          example_translation: raw.example_translation ?? null,
          audio_text: raw.audio_text ?? input.word,
        }),
      ];
    })
  );
}

export async function generateVocabularyGoldContentBatch(params: {
  items: VocabularyGoldContentGenerationItem[];
  actorType?: "admin" | "system";
}) {
  if (params.items.length === 0) {
    return new Map<string, VocabularyGoldContentRecord>();
  }

  const prompt = `${GOLD_CONTENT_SYSTEM_PROMPT}

INPUT_JSON:
${JSON.stringify({
    prompt_version: VOCABULARY_GOLD_CONTENT_PROMPT_VERSION,
    items: params.items.map((item) => ({
      word: item.word,
      item_type: item.itemType,
      target_language: item.targetLanguage,
      part_of_speech_hint: item.partOfSpeechHint ?? null,
      definition_hint: item.definitionHint ?? null,
      translation_hint: item.translationHint ?? null,
      example_hint: item.exampleHint ?? null,
      requested_fields: item.fields ?? null,
    })),
  })}`;

  const response = await createTrackedResponse({
    route: "vocabulary.generate_gold_content_batch",
    model: AI_MODELS.liveReasoning,
    actorType: params.actorType ?? "admin",
    input: prompt,
    metadata: {
      item_count: params.items.length,
      prompt_version: VOCABULARY_GOLD_CONTENT_PROMPT_VERSION,
    },
  });

  const parsed = extractJsonObject(response.output_text || "");
  return normalizeGeneratedItems(params.items, parsed.items ?? []);
}

export async function repairVocabularyGoldContentBatch(params: {
  items: Array<{
    current: VocabularyGoldContentRecord;
    targetLanguage: string;
    failingFields: VocabularyGoldContentField[];
    issues: string[];
  }>;
  actorType?: "admin" | "system";
}) {
  if (params.items.length === 0) {
    return new Map<string, Partial<VocabularyGoldContentRecord>>();
  }

  const prompt = `${GOLD_CONTENT_REPAIR_SYSTEM_PROMPT}

INPUT_JSON:
${JSON.stringify({
    prompt_version: VOCABULARY_GOLD_CONTENT_REPAIR_PROMPT_VERSION,
    items: params.items.map((item) => ({
      word: item.current.word,
      target_language: item.targetLanguage,
      failing_fields: item.failingFields,
      issues: item.issues,
      current_content: item.current,
    })),
  })}`;

  const response = await createTrackedResponse({
    route: "vocabulary.repair_gold_content_batch",
    model: AI_MODELS.liveReasoning,
    actorType: params.actorType ?? "admin",
    input: prompt,
    metadata: {
      item_count: params.items.length,
      prompt_version: VOCABULARY_GOLD_CONTENT_REPAIR_PROMPT_VERSION,
    },
  });

  const repairs = extractRepairJsonObject(response.output_text || "");
  const result = new Map<string, Partial<VocabularyGoldContentRecord>>();

  for (const repair of repairs) {
    if (!repair.word || !repair.fields || typeof repair.fields !== "object") {
      continue;
    }

    result.set(normalizeKey(repair.word), repair.fields);
  }

  return result;
}
