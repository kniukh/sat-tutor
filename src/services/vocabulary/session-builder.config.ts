import type {
  SupportedVocabExerciseType,
  VocabExerciseQueueBucket,
} from "@/types/vocab-exercises";
import type {
  VocabDifficultyBand,
  WordLifecycleState,
} from "@/types/vocab-tracking";
import type { SessionDifficultyBias } from "@/services/vocabulary/adaptive-difficulty.service";

type SessionBuilderMode =
  | "default_review"
  | "weak_first"
  | "mixed"
  | "learn_new_words"
  | "review_weak_words"
  | "mixed_practice";

type ProgressionRuleKey =
  | "lesson_word_intro"
  | "new_word_intro"
  | "weak_word_retry"
  | "learning_reinforcement"
  | "retention_check";

export const SESSION_PREFERRED_TYPE_ORDER_BY_MODE: Record<
  SessionBuilderMode,
  SupportedVocabExerciseType[]
> = {
  default_review: [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "listen_match",
    "spelling_from_audio",
    "spelling_from_audio",
    "synonym",
    "context_meaning",
  ],
  weak_first: [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "listen_match",
    "spelling_from_audio",
    "spelling_from_audio",
    "context_meaning",
    "synonym",
  ],
  mixed: [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "listen_match",
    "spelling_from_audio",
    "spelling_from_audio",
    "synonym",
    "context_meaning",
  ],
  learn_new_words: [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "listen_match",
    "spelling_from_audio",
    "spelling_from_audio",
    "synonym",
    "context_meaning",
  ],
  review_weak_words: [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "listen_match",
    "spelling_from_audio",
    "spelling_from_audio",
    "context_meaning",
    "synonym",
  ],
  mixed_practice: [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "listen_match",
    "spelling_from_audio",
    "spelling_from_audio",
    "synonym",
    "context_meaning",
  ],
};

export const SESSION_BUCKET_PRIORITY_ORDER_BY_MODE: Record<
  SessionBuilderMode,
  VocabExerciseQueueBucket[]
> = {
  default_review: [
    "reinforcement",
    "scheduled",
    "overdue",
    "recently_failed",
    "weak_again",
  ],
  weak_first: [
    "recently_failed",
    "weak_again",
    "overdue",
    "reinforcement",
    "scheduled",
  ],
  mixed: [
    "recently_failed",
    "reinforcement",
    "weak_again",
    "overdue",
    "scheduled",
  ],
  learn_new_words: [
    "reinforcement",
    "scheduled",
    "overdue",
    "recently_failed",
    "weak_again",
  ],
  review_weak_words: [
    "recently_failed",
    "weak_again",
    "overdue",
    "reinforcement",
    "scheduled",
  ],
  mixed_practice: [
    "recently_failed",
    "weak_again",
    "reinforcement",
    "overdue",
    "scheduled",
  ],
};

export const SESSION_BUCKET_TARGET_RATIOS_BY_MODE: Record<
  SessionBuilderMode,
  Partial<Record<VocabExerciseQueueBucket, number>>
> = {
  default_review: {
    reinforcement: 0.45,
    scheduled: 0.35,
    overdue: 0.15,
    recently_failed: 0.05,
  },
  weak_first: {
    recently_failed: 0.4,
    weak_again: 0.3,
    overdue: 0.2,
    reinforcement: 0.1,
  },
  mixed: {
    recently_failed: 0.2,
    reinforcement: 0.3,
    weak_again: 0.2,
    overdue: 0.2,
    scheduled: 0.1,
  },
  learn_new_words: {
    reinforcement: 0.6,
    scheduled: 0.4,
  },
  review_weak_words: {
    recently_failed: 0.4,
    weak_again: 0.3,
    overdue: 0.2,
    reinforcement: 0.1,
  },
  mixed_practice: {
    recently_failed: 0.3,
    weak_again: 0.25,
    reinforcement: 0.25,
    overdue: 0.15,
    scheduled: 0.05,
  },
};

export const SESSION_PROGRESSION_RULES: Record<
  ProgressionRuleKey,
  {
    rule: ProgressionRuleKey;
    types: SupportedVocabExerciseType[];
  }
> = {
  lesson_word_intro: {
    rule: "lesson_word_intro",
    types: [
      "meaning_match",
      "translation_match",
      "pair_match",
      "listen_match",
      "context_meaning",
      "spelling_from_audio",
      "synonym",
      "listen_match",
      "spelling_from_audio",
    ],
  },
  new_word_intro: {
    rule: "new_word_intro",
    types: [
      "meaning_match",
      "translation_match",
      "pair_match",
      "listen_match",
      "spelling_from_audio",
      "context_meaning",
      "spelling_from_audio",
      "synonym",
    ],
  },
  weak_word_retry: {
    rule: "weak_word_retry",
    types: [
      "meaning_match",
      "translation_match",
      "pair_match",
      "listen_match",
      "spelling_from_audio",
      "spelling_from_audio",
      "context_meaning",
      "synonym",
    ],
  },
  learning_reinforcement: {
    rule: "learning_reinforcement",
    types: [
      "spelling_from_audio",
      "translation_match",
      "pair_match",
      "listen_match",
      "spelling_from_audio",
      "synonym",
      "context_meaning",
      "meaning_match",
    ],
  },
  retention_check: {
    rule: "retention_check",
    types: [
      "translation_match",
      "pair_match",
      "listen_match",
      "spelling_from_audio",
      "spelling_from_audio",
      "synonym",
      "context_meaning",
      "meaning_match",
    ],
  },
};

export const SESSION_TYPE_ORDER_BY_ADAPTIVE_DIFFICULTY: Record<
  VocabDifficultyBand,
  SupportedVocabExerciseType[]
> = {
  easy: [
    "meaning_match",
    "translation_match",
    "pair_match",
    "listen_match",
    "spelling_from_audio",
    "context_meaning",
    "synonym",
    "spelling_from_audio",
  ],
  medium: [
    "spelling_from_audio",
    "translation_match",
    "pair_match",
    "listen_match",
    "synonym",
    "context_meaning",
    "meaning_match",
    "spelling_from_audio",
  ],
  hard: [
    "context_meaning",
    "spelling_from_audio",
    "spelling_from_audio",
    "synonym",
    "listen_match",
    "pair_match",
    "meaning_match",
  ],
};

export const SESSION_DEFAULT_DIFFICULTY_BY_TYPE: Record<
  SupportedVocabExerciseType,
  number
> = {
  meaning_match: 1,
  translation_match: 1,
  pair_match: 1,
  listen_match: 1,
  spelling_from_audio: 3,
  fill_blank: 2,
  sentence_builder: 3,
  error_detection: 3,
  context_meaning: 3,
  synonym: 2,
  collocation: 3,
};

export const SESSION_DIFFICULTY_TARGET_BY_BAND: Record<VocabDifficultyBand, number> = {
  easy: 1.2,
  medium: 2.1,
  hard: 2.9,
};

export const SESSION_DIFFICULTY_BIAS_SHIFT: Record<SessionDifficultyBias, number> = {
  supportive: -0.35,
  balanced: 0,
  stretch: 0.35,
};

export function resolveSessionProgressionRule(params: {
  mode: SessionBuilderMode;
  lifecycleState: WordLifecycleState | null;
  selectionBucket: "weak_recent" | "reinforcement" | "newer_words" | "retention_check";
  selectionRule?: string | null;
}) {
  const { mode, lifecycleState, selectionBucket, selectionRule } = params;

  if (
    selectionRule &&
    selectionRule in SESSION_PROGRESSION_RULES
  ) {
    return SESSION_PROGRESSION_RULES[selectionRule as ProgressionRuleKey];
  }

  if (lifecycleState === "new" || selectionBucket === "newer_words" || mode === "learn_new_words") {
    return SESSION_PROGRESSION_RULES.new_word_intro;
  }

  if (lifecycleState === "weak_again" || selectionBucket === "weak_recent") {
    return SESSION_PROGRESSION_RULES.weak_word_retry;
  }

  if (
    lifecycleState === "learning" ||
    lifecycleState === "review" ||
    selectionBucket === "reinforcement"
  ) {
    return SESSION_PROGRESSION_RULES.learning_reinforcement;
  }

  return SESSION_PROGRESSION_RULES.retention_check;
}
