import type {
  CollocationVocabExercise,
  ContextMeaningVocabExercise,
  ErrorDetectionVocabExercise,
  FillBlankVocabExercise,
  ListenMatchVocabExercise,
  MeaningMatchVocabExercise,
  PairMatchVocabExercise,
  SentenceBuilderVocabExercise,
  SpellingFromAudioVocabExercise,
  SupportedVocabExercise,
  SupportedVocabExerciseType,
  SynonymVocabExercise,
  TranslationMatchVocabExercise,
  VocabExerciseOption,
  VocabExerciseResult,
} from "@/types/vocab-exercises";
import type { ReactNode } from "react";

export type ExerciseType = SupportedVocabExerciseType;
export type ExerciseOption = VocabExerciseOption;
export type MeaningMatchExerciseData =
  | MeaningMatchVocabExercise
  | TranslationMatchVocabExercise;
export type PairMatchExerciseData = PairMatchVocabExercise;
export type ListenMatchExerciseData = ListenMatchVocabExercise;
export type SpellingFromAudioExerciseData = SpellingFromAudioVocabExercise;
export type SentenceBuilderExerciseData = SentenceBuilderVocabExercise;
export type ErrorDetectionExerciseData = ErrorDetectionVocabExercise;
export type FillBlankExerciseData = FillBlankVocabExercise;
export type ContextMeaningExerciseData = ContextMeaningVocabExercise;
export type SynonymExerciseData = SynonymVocabExercise;
export type CollocationExerciseData = CollocationVocabExercise;
export type Exercise = SupportedVocabExercise;
export type ExerciseResult = VocabExerciseResult;
export type ExerciseCaptureRenderParams = {
  text: string;
  contextText?: string | null;
  isDistractor?: boolean;
  className?: string;
  highlightText?: string | null;
  as?: "span" | "div";
};

export type ExerciseRendererProps<TExercise extends Exercise = Exercise> = {
  exercise: TExercise;
  selectedValue: string;
  onSelect: (value: string) => void;
  submitted: boolean;
  focused?: boolean;
  renderCaptureText?: (params: ExerciseCaptureRenderParams) => ReactNode;
};
