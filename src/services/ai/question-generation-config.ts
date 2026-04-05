export const QUESTION_QUALITY_CONFIG = {
  reading: {
    minPlausibleDistractors: 2,
    maxExtraWords: 8,
    maxLengthMultiplier: 2.35,
    plausibleGapMultiplier: 0.45,
  },
  vocabulary: {
    minPlausibleDistractors: 2,
    maxExtraWords: 4,
    maxLengthMultiplier: 2.5,
    plausibleGapMultiplier: 0.5,
  },
  retry: {
    maxAttempts: 2,
    maxFeedbackLength: 280,
  },
} as const;

export type QuestionQualitySemanticMode = keyof Omit<typeof QUESTION_QUALITY_CONFIG, "retry">;
