import type { SupportedVocabExercise } from "@/types/vocab-exercises";
import { mockExercises } from "@/components/student/exercise-player/mock-exercises";
import {
  buildVocabExerciseSession,
  type VocabSessionMode,
} from "./session-builder";

const extendedMockPool: SupportedVocabExercise[] = [
  ...mockExercises,
  {
    id: "exercise-meaning-match-vivid",
    type: "meaning_match",
    prompt: "Choose the best meaning.",
    instructions: "Match the word to its closest meaning.",
    target_word: "vivid",
    target_word_id: "word-vivid",
    question_text: "Which option is the best meaning of 'vivid'?",
    options: [
      { id: "a", label: "bright and detailed" },
      { id: "b", label: "slow and quiet" },
      { id: "c", label: "difficult to carry" },
      { id: "d", label: "plain and empty" },
    ],
    correct_answer: "a",
    acceptable_answers: ["a"],
    distractors: ["slow and quiet", "difficult to carry", "plain and empty"],
    explanation: "Vivid often means bright, strong, and easy to imagine.",
    modality: "text",
    difficulty_band: "easy",
    tags: ["meaning"],
    skill: "meaning_match",
    metadata: {
      mock: true,
    },
    reviewMeta: {},
  },
  {
    id: "exercise-context-meaning-reluctant",
    type: "context_meaning",
    prompt: "What does the highlighted word mean in context?",
    instructions: "Use the sentence to infer the meaning.",
    target_word: "reluctant",
    target_word_id: "word-reluctant",
    question_text: "What does 'reluctant' mean in this sentence?",
    sentence_text: "She was reluctant to speak, even after the teacher encouraged her.",
    contextText: "She was reluctant to speak, even after the teacher encouraged her.",
    focusText: "reluctant",
    options: [
      { id: "a", label: "eager" },
      { id: "b", label: "hesitant" },
      { id: "c", label: "proud" },
      { id: "d", label: "noisy" },
    ],
    correct_answer: "b",
    acceptable_answers: ["b"],
    distractors: ["eager", "proud", "noisy"],
    explanation: "Reluctant means unwilling or hesitant.",
    modality: "context",
    difficulty_band: "hard",
    tags: ["context"],
    skill: "context_meaning",
    metadata: {
      mock: true,
    },
    reviewMeta: {},
  },
  {
    id: "exercise-collocation-heavy-rain",
    type: "collocation",
    prompt: "Choose the most natural collocation.",
    instructions: "Pick the phrase that sounds most natural in English.",
    target_word: "rain",
    target_word_id: "word-rain",
    question_text: "Which option forms the most natural collocation?",
    stem: "heavy ____",
    options: [
      { id: "a", label: "rain" },
      { id: "b", label: "friendship" },
      { id: "c", label: "clarity" },
      { id: "d", label: "curiousness" },
    ],
    correct_answer: "a",
    acceptable_answers: ["a"],
    distractors: ["friendship", "clarity", "curiousness"],
    explanation: "Heavy rain is a common natural collocation.",
    modality: "text",
    difficulty_band: "medium",
    tags: ["collocation"],
    skill: "collocation",
    metadata: {
      mock: true,
    },
    reviewMeta: {},
  },
];

export const mockSessionExamples = {
  default_review: buildVocabExerciseSession({
    exercises: extendedMockPool,
    mode: "default_review",
    seed: "default-review-example",
  }),
  weak_first: buildVocabExerciseSession({
    exercises: extendedMockPool,
    mode: "weak_first",
    seed: "weak-first-example",
  }),
  mixed: buildVocabExerciseSession({
    exercises: extendedMockPool,
    mode: "mixed",
    seed: "mixed-drill-example",
  }),
  learn_new_words: buildVocabExerciseSession({
    exercises: extendedMockPool,
    mode: "learn_new_words",
    seed: "learn-new-words-example",
  }),
  review_weak_words: buildVocabExerciseSession({
    exercises: extendedMockPool,
    mode: "review_weak_words",
    seed: "review-weak-words-example",
  }),
  mixed_practice: buildVocabExerciseSession({
    exercises: extendedMockPool,
    mode: "mixed_practice",
    seed: "mixed-practice-example",
  }),
} satisfies Record<VocabSessionMode, ReturnType<typeof buildVocabExerciseSession>>;
