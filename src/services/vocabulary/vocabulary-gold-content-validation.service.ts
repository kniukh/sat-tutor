export const VOCABULARY_GOLD_CONTENT_FIELDS = [
  "part_of_speech",
  "core_meaning",
  "definition",
  "translation_word",
  "translation_meaning",
  "synonyms",
  "antonyms",
  "example_sentence",
  "example_translation",
  "audio_text",
] as const;

export type VocabularyGoldContentField =
  (typeof VOCABULARY_GOLD_CONTENT_FIELDS)[number];

export type VocabularyGoldContentRecord = {
  word: string;
  part_of_speech: string | null;
  core_meaning: string | null;
  definition: string | null;
  translation_word: string | null;
  translation_meaning: string | null;
  synonyms: string[];
  antonyms: string[];
  example_sentence: string | null;
  example_translation: string | null;
  audio_text: string | null;
};

export type VocabularyGoldContentValidationIssue = {
  field: VocabularyGoldContentField | "record";
  code: string;
  severity: "error" | "warning";
  message: string;
  repairable: boolean;
};

export type VocabularyGoldContentValidationResult = {
  content: VocabularyGoldContentRecord;
  issues: VocabularyGoldContentValidationIssue[];
  isValidForSave: boolean;
  qualityScore: number;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeComparable(value: unknown) {
  return normalizeText(value)?.toLowerCase() ?? "";
}

function normalizeTextArray(value: unknown, limit: number, targetWord?: string) {
  if (!Array.isArray(value)) {
    return [];
  }

  const targetKey = normalizeComparable(targetWord);
  const deduped = new Map<string, string>();

  for (const item of value) {
    const normalized = normalizeText(item);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!key || key === targetKey || deduped.has(key)) {
      continue;
    }

    deduped.set(key, normalized);
  }

  return Array.from(deduped.values()).slice(0, limit);
}

function tokenCount(value: string | null | undefined) {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function containsTargetOrInflection(sentence: string | null, word: string) {
  const source = normalizeComparable(sentence);
  const target = normalizeComparable(word);
  if (!source || !target) {
    return false;
  }

  if (source.includes(target)) {
    return true;
  }

  const compactTarget = target.replace(/[^\p{L}\p{N}]+/gu, "");
  const compactSource = source.replace(/[^\p{L}\p{N}\s]+/gu, "");
  if (compactTarget.length >= 4 && compactSource.includes(compactTarget)) {
    return true;
  }

  const base = target.replace(/(?:ing|ed|es|s)$/u, "");
  return base.length >= 4 && source.includes(base);
}

function hasSuspiciousCharacters(value: string | null) {
  return Boolean(value && /[\uFFFD�{}[\]|<>_=]/u.test(value));
}

function addIssue(
  issues: VocabularyGoldContentValidationIssue[],
  issue: VocabularyGoldContentValidationIssue
) {
  issues.push(issue);
}

export function sanitizeVocabularyGoldContentRecord(
  raw: Partial<VocabularyGoldContentRecord> & { word: string },
  params?: { targetWord?: string }
): VocabularyGoldContentRecord {
  const word = normalizeText(raw.word) ?? normalizeText(params?.targetWord) ?? "";
  const audioText = normalizeText(raw.audio_text) ?? word;

  return {
    word,
    part_of_speech: normalizeText(raw.part_of_speech),
    core_meaning: normalizeText(raw.core_meaning),
    definition: normalizeText(raw.definition),
    translation_word: normalizeText(raw.translation_word),
    translation_meaning: normalizeText(raw.translation_meaning),
    synonyms: normalizeTextArray(raw.synonyms, 8, word),
    antonyms: normalizeTextArray(raw.antonyms, 6, word),
    example_sentence: normalizeText(raw.example_sentence),
    example_translation: normalizeText(raw.example_translation),
    audio_text: audioText,
  };
}

export function validateVocabularyGoldContent(
  raw: Partial<VocabularyGoldContentRecord> & { word: string }
): VocabularyGoldContentValidationResult {
  const content = sanitizeVocabularyGoldContentRecord(raw);
  const issues: VocabularyGoldContentValidationIssue[] = [];

  if (!content.word) {
    addIssue(issues, {
      field: "record",
      code: "missing_word",
      severity: "error",
      message: "The generated record is missing the target word.",
      repairable: false,
    });
  }

  const requiredFields: VocabularyGoldContentField[] = [
    "part_of_speech",
    "core_meaning",
    "definition",
    "translation_word",
    "translation_meaning",
    "example_sentence",
    "audio_text",
  ];

  for (const field of requiredFields) {
    if (!normalizeText(content[field])) {
      addIssue(issues, {
        field,
        code: `missing_${field}`,
        severity: "error",
        message: `${field} is required for reusable drill content.`,
        repairable: field !== "audio_text",
      });
    }
  }

  const coreTokens = tokenCount(content.core_meaning);
  if (content.core_meaning && (coreTokens < 2 || coreTokens > 10)) {
    addIssue(issues, {
      field: "core_meaning",
      code: "core_meaning_not_concise",
      severity: coreTokens > 14 ? "error" : "warning",
      message: "core_meaning should be a short 3-8 word gloss.",
      repairable: true,
    });
  }

  if (content.definition && tokenCount(content.definition) > 45) {
    addIssue(issues, {
      field: "definition",
      code: "definition_too_long",
      severity: "error",
      message: "definition should not be excessively long.",
      repairable: true,
    });
  }

  const translationWordTokens = tokenCount(content.translation_word);
  if (content.translation_word && translationWordTokens > 3) {
    addIssue(issues, {
      field: "translation_word",
      code: "translation_word_too_long",
      severity: "error",
      message: "translation_word must be a concise lexical translation: ideally 1 word, maximum 2-3 words.",
      repairable: true,
    });
  }

  if (
    content.translation_word &&
    content.translation_meaning &&
    normalizeComparable(content.translation_word) === normalizeComparable(content.translation_meaning)
  ) {
    addIssue(issues, {
      field: "translation_word",
      code: "translation_word_identical_to_translation_meaning",
      severity: "warning",
      message: "translation_word and translation_meaning should usually be distinct.",
      repairable: true,
    });
  }

  if (
    content.translation_word &&
    normalizeComparable(content.translation_word) === normalizeComparable(content.word)
  ) {
    addIssue(issues, {
      field: "translation_word",
      code: "translation_word_identical_to_word",
      severity: "error",
      message: "translation_word should not simply copy the English word.",
      repairable: true,
    });
  }

  if (
    content.example_sentence &&
    !containsTargetOrInflection(content.example_sentence, content.word)
  ) {
    addIssue(issues, {
      field: "example_sentence",
      code: "example_sentence_missing_target",
      severity: "error",
      message: "example_sentence should contain the target word or a clear inflected form.",
      repairable: true,
    });
  }

  for (const field of ["core_meaning", "definition", "translation_word", "translation_meaning"] as const) {
    if (hasSuspiciousCharacters(content[field])) {
      addIssue(issues, {
        field,
        code: `${field}_suspicious_characters`,
        severity: "error",
        message: `${field} contains suspicious characters.`,
        repairable: true,
      });
    }
  }

  if (content.synonyms.some((candidate) => normalizeComparable(candidate) === normalizeComparable(content.word))) {
    addIssue(issues, {
      field: "synonyms",
      code: "synonyms_include_target",
      severity: "warning",
      message: "synonyms should not include the target word.",
      repairable: true,
    });
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const qualityScore = Math.max(0, Math.min(1, 1 - errorCount * 0.2 - warningCount * 0.05));

  return {
    content,
    issues,
    isValidForSave: errorCount === 0,
    qualityScore: Number(qualityScore.toFixed(2)),
  };
}

export function getRepairableVocabularyGoldContentFields(
  issues: VocabularyGoldContentValidationIssue[]
) {
  return Array.from(
    new Set(
      issues
        .filter((issue) => issue.repairable && issue.field !== "record")
        .map((issue) => issue.field as VocabularyGoldContentField)
    )
  );
}

export function mergeVocabularyGoldContentRepair(
  current: VocabularyGoldContentRecord,
  patch: Partial<VocabularyGoldContentRecord>
) {
  return sanitizeVocabularyGoldContentRecord({
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) =>
        Array.isArray(value) ? value.length > 0 : normalizeText(value)
      )
    ),
    word: current.word,
    audio_text: normalizeText(patch.audio_text) ?? current.audio_text ?? current.word,
  });
}
