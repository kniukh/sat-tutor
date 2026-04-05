import {
  generateVocabularyDrillOptions,
  generateVocabularyDrillOptionsBatch,
} from "@/services/ai/generate-vocabulary-drill-options";

type VocabularyDistractorInput = {
  itemText: string;
  itemType: "word" | "phrase";
  correctAnswer: string;
  studentId?: string | null;
  contextSentence?: string | null;
  exampleText?: string | null;
  existingDistractors?: string[] | null;
  fallbackPool?: string[];
};

type DistractorAudit = {
  normalizedDistractors: string[];
  issues: string[];
  needsRefinement: boolean;
};

const GENERIC_DISTRACTOR_SET = new Set([
  "thing",
  "something",
  "someone",
  "somebody",
  "person",
  "object",
  "place",
  "good",
  "bad",
  "nice",
  "stuff",
  "very good",
  "very bad",
]);

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeOptionStyle(text: string, reference: string) {
  const collapsed = normalizeWhitespace(text).replace(/[.!?;:,]+$/g, "");
  if (!collapsed) {
    return "";
  }

  const referenceStartsUppercase = /^[A-Z]/.test(reference.trim());
  if (!referenceStartsUppercase) {
    return collapsed.charAt(0).toLowerCase() + collapsed.slice(1);
  }

  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
}

function normalizeForCompare(text: string) {
  return normalizeWhitespace(text)
    .replace(/[.!?;:,]+$/g, "")
    .toLowerCase();
}

function countTokens(text: string) {
  return normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
}

function isGenericDistractor(text: string) {
  const normalized = normalizeForCompare(text);
  return GENERIC_DISTRACTOR_SET.has(normalized);
}

function looksLikeOppositeMarker(text: string) {
  const normalized = normalizeForCompare(text);
  return (
    normalized.startsWith("not ") ||
    normalized.startsWith("opposite ") ||
    normalized.startsWith("the opposite") ||
    normalized.includes(" opposite of ")
  );
}

function isTooCloseToCorrect(candidate: string, correctAnswer: string) {
  const normalizedCandidate = normalizeForCompare(candidate);
  const normalizedCorrect = normalizeForCompare(correctAnswer);

  if (!normalizedCandidate || !normalizedCorrect) {
    return true;
  }

  if (normalizedCandidate === normalizedCorrect) {
    return true;
  }

  return (
    normalizedCandidate.includes(normalizedCorrect) ||
    normalizedCorrect.includes(normalizedCandidate)
  );
}

function scoreCandidate(candidate: string, correctAnswer: string, itemType: "word" | "phrase") {
  const candidateLength = normalizeForCompare(candidate).length;
  const correctLength = normalizeForCompare(correctAnswer).length;
  const candidateTokens = countTokens(candidate);
  const correctTokens = countTokens(correctAnswer);
  const lengthRatio =
    correctLength > 0 ? Math.min(candidateLength, correctLength) / Math.max(candidateLength, correctLength) : 0;

  let score = 0;

  if (itemType === "phrase") {
    score += candidateTokens >= 2 ? 3 : -2;
  } else {
    score += candidateTokens <= 4 ? 2 : -1;
  }

  if (Math.abs(candidateTokens - correctTokens) <= 1) {
    score += 4;
  } else if (Math.abs(candidateTokens - correctTokens) === 2) {
    score += 1;
  } else {
    score -= 2;
  }

  if (lengthRatio >= 0.55) {
    score += 3;
  } else if (lengthRatio >= 0.4) {
    score += 1;
  } else {
    score -= 2;
  }

  if (/[,-]/.test(candidate) === /[,-]/.test(correctAnswer)) {
    score += 1;
  }

  return score;
}

function finalizeDistractorSet(params: {
  correctAnswer: string;
  itemType: "word" | "phrase";
  candidates: string[];
}) {
  const deduped = new Map<
    string,
    {
      value: string;
      score: number;
    }
  >();

  for (const rawCandidate of params.candidates) {
    const normalizedValue = normalizeOptionStyle(rawCandidate, params.correctAnswer);
    const compareKey = normalizeForCompare(normalizedValue);

    if (!normalizedValue || !compareKey) {
      continue;
    }

    if (isTooCloseToCorrect(normalizedValue, params.correctAnswer)) {
      continue;
    }

    if (isGenericDistractor(normalizedValue)) {
      continue;
    }

    if (looksLikeOppositeMarker(normalizedValue)) {
      continue;
    }

    const score = scoreCandidate(normalizedValue, params.correctAnswer, params.itemType);
    const existing = deduped.get(compareKey);

    if (!existing || score > existing.score) {
      deduped.set(compareKey, {
        value: normalizedValue,
        score,
      });
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.score - left.score)
    .map((item) => item.value);
}

export function auditVocabularyDistractors(params: {
  correctAnswer: string;
  distractors: string[] | null | undefined;
  itemType: "word" | "phrase";
}): DistractorAudit {
  const input = params.distractors ?? [];
  const refined = finalizeDistractorSet({
    correctAnswer: params.correctAnswer,
    itemType: params.itemType,
    candidates: input,
  });
  const issues: string[] = [];

  if (input.length < 3) {
    issues.push("too_few_distractors");
  }

  if (refined.length < 3) {
    issues.push("insufficient_quality_candidates");
  }

  if (input.some((item) => isTooCloseToCorrect(item, params.correctAnswer))) {
    issues.push("contains_correct_or_near_duplicate");
  }

  if (input.some(isGenericDistractor)) {
    issues.push("contains_generic_distractor");
  }

  if (input.some(looksLikeOppositeMarker)) {
    issues.push("contains_obvious_opposite_marker");
  }

  const dedupedInput = new Set(input.map((item) => normalizeForCompare(item)).filter(Boolean));
  if (dedupedInput.size !== input.length) {
    issues.push("contains_duplicates");
  }

  return {
    normalizedDistractors: refined.slice(0, 4),
    issues,
    needsRefinement: issues.length > 0,
  };
}

export async function prepareVocabularyDistractors(
  input: VocabularyDistractorInput
) {
  const audit = auditVocabularyDistractors({
    correctAnswer: input.correctAnswer,
    distractors: input.existingDistractors,
    itemType: input.itemType,
  });

  const fallbackCandidates = finalizeDistractorSet({
    correctAnswer: input.correctAnswer,
    itemType: input.itemType,
    candidates: input.fallbackPool ?? [],
  });

  if (!audit.needsRefinement && audit.normalizedDistractors.length >= 3) {
    return audit.normalizedDistractors.slice(0, 4);
  }

  let aiDistractors: string[] = [];

  try {
    const generated = await generateVocabularyDrillOptions({
      itemText: input.itemText,
      itemType: input.itemType,
      plainEnglishMeaning: input.correctAnswer,
      studentId: input.studentId ?? null,
      contextSentence: input.contextSentence ?? null,
      exampleText: input.exampleText ?? null,
      existingDistractors: input.existingDistractors ?? [],
      fallbackPool: input.fallbackPool ?? [],
    });

    aiDistractors = generated.distractors ?? [];
  } catch (error) {
    console.error("prepareVocabularyDistractors ai generation failed", error);
  }

  const combined = finalizeDistractorSet({
    correctAnswer: input.correctAnswer,
    itemType: input.itemType,
    candidates: [
      ...aiDistractors,
      ...(input.existingDistractors ?? []),
      ...fallbackCandidates,
    ],
  });

  return combined.slice(0, 4);
}

function buildDistractorCacheKey(input: {
  itemText: string;
  correctAnswer: string;
}) {
  return `${normalizeForCompare(input.itemText)}::${normalizeForCompare(input.correctAnswer)}`;
}

export async function prepareVocabularyDistractorsBatch(
  inputs: VocabularyDistractorInput[]
) {
  const resolved = new Map<string, string[]>();
  const inputsNeedingAi: VocabularyDistractorInput[] = [];

  for (const input of inputs) {
    const audit = auditVocabularyDistractors({
      correctAnswer: input.correctAnswer,
      distractors: input.existingDistractors,
      itemType: input.itemType,
    });

    if (!audit.needsRefinement && audit.normalizedDistractors.length >= 3) {
      resolved.set(
        buildDistractorCacheKey(input),
        audit.normalizedDistractors.slice(0, 4)
      );
      continue;
    }

    inputsNeedingAi.push(input);
  }

  const aiBatchMap =
    inputsNeedingAi.length > 0
      ? await generateVocabularyDrillOptionsBatch(
          inputsNeedingAi.map((input) => ({
            itemText: input.itemText,
            itemType: input.itemType,
            plainEnglishMeaning: input.correctAnswer,
            studentId: input.studentId ?? null,
            contextSentence: input.contextSentence ?? null,
            exampleText: input.exampleText ?? null,
            existingDistractors: input.existingDistractors ?? [],
            fallbackPool: input.fallbackPool ?? [],
          }))
        ).catch((error) => {
          console.error("prepareVocabularyDistractorsBatch ai generation failed", error);
          return new Map<string, { correct_answer: string; distractors: string[] }>();
        })
      : new Map<string, { correct_answer: string; distractors: string[] }>();

  for (const input of inputsNeedingAi) {
    const fallbackCandidates = finalizeDistractorSet({
      correctAnswer: input.correctAnswer,
      itemType: input.itemType,
      candidates: input.fallbackPool ?? [],
    });
    const aiDistractors =
      aiBatchMap.get(normalizeForCompare(input.itemText))?.distractors ?? [];

    const combined = finalizeDistractorSet({
      correctAnswer: input.correctAnswer,
      itemType: input.itemType,
      candidates: [
        ...aiDistractors,
        ...(input.existingDistractors ?? []),
        ...fallbackCandidates,
      ],
    });

    resolved.set(buildDistractorCacheKey(input), combined.slice(0, 4));
  }

  return resolved;
}
