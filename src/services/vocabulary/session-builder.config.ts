import type {
  SupportedVocabExerciseType,
  VocabExerciseQueueBucket,
} from "@/types/vocab-exercises";
import type { WordLifecycleState } from "@/types/vocab-tracking";

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
    "listen_match",
    "spelling_from_audio",
    "fill_blank",
    "synonym",
    "context_meaning",
    "collocation",
  ],
  weak_first: [
    "meaning_match",
    "listen_match",
    "spelling_from_audio",
    "fill_blank",
    "context_meaning",
    "synonym",
    "collocation",
  ],
  mixed: [
    "meaning_match",
    "listen_match",
    "spelling_from_audio",
    "synonym",
    "fill_blank",
    "collocation",
    "context_meaning",
  ],
  learn_new_words: [
    "meaning_match",
    "listen_match",
    "spelling_from_audio",
    "synonym",
    "fill_blank",
    "collocation",
    "context_meaning",
  ],
  review_weak_words: [
    "meaning_match",
    "listen_match",
    "spelling_from_audio",
    "fill_blank",
    "context_meaning",
    "synonym",
    "collocation",
  ],
  mixed_practice: [
    "meaning_match",
    "listen_match",
    "spelling_from_audio",
    "fill_blank",
    "synonym",
    "context_meaning",
    "collocation",
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
      "context_meaning",
      "fill_blank",
      "synonym",
      "listen_match",
      "collocation",
      "spelling_from_audio",
    ],
  },
  new_word_intro: {
    rule: "new_word_intro",
    types: [
      "meaning_match",
      "listen_match",
      "spelling_from_audio",
      "context_meaning",
      "fill_blank",
      "synonym",
      "collocation",
    ],
  },
  weak_word_retry: {
    rule: "weak_word_retry",
    types: [
      "meaning_match",
      "listen_match",
      "spelling_from_audio",
      "fill_blank",
      "context_meaning",
      "synonym",
      "collocation",
    ],
  },
  learning_reinforcement: {
    rule: "learning_reinforcement",
    types: [
      "fill_blank",
      "listen_match",
      "spelling_from_audio",
      "synonym",
      "collocation",
      "context_meaning",
      "meaning_match",
    ],
  },
  retention_check: {
    rule: "retention_check",
    types: [
      "listen_match",
      "spelling_from_audio",
      "synonym",
      "collocation",
      "context_meaning",
      "fill_blank",
      "meaning_match",
    ],
  },
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
