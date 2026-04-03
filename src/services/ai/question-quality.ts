import {
  QUESTION_QUALITY_CONFIG,
  type QuestionQualitySemanticMode,
} from "@/services/ai/question-generation-config";

type OptionKey = 'A' | 'B' | 'C' | 'D';

type QuestionWithOptions = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionKey;
};

type QuestionQualityParams = {
  label?: string;
  semanticMode?: QuestionQualitySemanticMode;
  minPlausibleDistractors?: number;
};

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripLeadingMarker(value: string) {
  return value.replace(/^[A-D][\.\):]\s*/i, '').trim();
}

function stripSoftTerminalPunctuation(value: string) {
  return value.replace(/[.;:,]+$/g, '').trim();
}

function normalizeOptionText(value: string) {
  return stripSoftTerminalPunctuation(stripLeadingMarker(collapseWhitespace(value)));
}

function comparableText(value: string) {
  return normalizeOptionText(value)
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(value: string) {
  return normalizeOptionText(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function getOptions(question: QuestionWithOptions) {
  return OPTION_KEYS.map((key) => ({
    key,
    text:
      key === 'A'
        ? question.option_a
        : key === 'B'
          ? question.option_b
          : key === 'C'
            ? question.option_c
            : question.option_d,
  }));
}

function withNormalizedOptions<T extends QuestionWithOptions>(question: T): T {
  return {
    ...question,
    question_text: collapseWhitespace(question.question_text),
    option_a: normalizeOptionText(question.option_a),
    option_b: normalizeOptionText(question.option_b),
    option_c: normalizeOptionText(question.option_c),
    option_d: normalizeOptionText(question.option_d),
  };
}

export function normalizeQuestionAnswerStyle<T extends QuestionWithOptions>(question: T): T {
  return withNormalizedOptions(question);
}

export function validateQuestionAnswerQuality<T extends QuestionWithOptions>(
  question: T,
  params?: QuestionQualityParams
) {
  const label = params?.label ?? 'question';
  const semanticMode = params?.semanticMode ?? 'reading';
  const thresholds = QUESTION_QUALITY_CONFIG[semanticMode];
  const minPlausibleDistractors = Math.max(
    1,
    params?.minPlausibleDistractors ?? thresholds.minPlausibleDistractors
  );
  const normalized = withNormalizedOptions(question);
  const options = getOptions(normalized);
  const comparable = options.map((option) => comparableText(option.text));

  if (new Set(comparable).size !== options.length) {
    throw new Error(`${label} has duplicate or near-duplicate answer options`);
  }

  const wordCounts = options.map((option) => countWords(option.text));
  const shortest = Math.min(...wordCounts);
  const longest = Math.max(...wordCounts);

  if (shortest <= 0) {
    throw new Error(`${label} has an empty answer option`);
  }

  const maxAllowedLengthGap = Math.max(
    shortest + thresholds.maxExtraWords,
    shortest * thresholds.maxLengthMultiplier
  );

  if (longest > maxAllowedLengthGap) {
    throw new Error(`${label} has answer choices with an obvious length mismatch`);
  }

  const correctIndex = OPTION_KEYS.indexOf(normalized.correct_option);

  if (correctIndex === -1) {
    throw new Error(`${label} has an invalid correct option`);
  }

  const correctWordCount = wordCounts[correctIndex];
  const plausibleGap = Math.max(
    semanticMode === 'vocabulary' ? 1 : 2,
    Math.round(correctWordCount * thresholds.plausibleGapMultiplier)
  );

  const plausibleDistractorCount = wordCounts.filter((count, index) => {
    if (index === correctIndex) {
      return false;
    }

    return Math.abs(count - correctWordCount) <= plausibleGap;
  }).length;

  if (plausibleDistractorCount < minPlausibleDistractors) {
    throw new Error(`${label} does not have enough structurally plausible distractors`);
  }

  const starts = options.map((option) => option.text.charAt(0)).filter(Boolean);
  const uppercaseStarts = starts.filter((character) => /[A-Z]/.test(character)).length;
  const lowercaseStarts = starts.filter((character) => /[a-z]/.test(character)).length;

  if (uppercaseStarts > 0 && lowercaseStarts > 0) {
    throw new Error(`${label} has inconsistent answer tone/casing`);
  }
}

export function normalizeAndValidateQuestionAnswers<T extends QuestionWithOptions>(
  question: T,
  params?: QuestionQualityParams
) {
  const normalized = withNormalizedOptions(question);
  validateQuestionAnswerQuality(normalized, params);
  return normalized;
}
