import type {
  CollocationVocabExercise,
  ContextMeaningVocabExercise,
  FillBlankVocabExercise,
  MeaningMatchVocabExercise,
  SupportedVocabExercise,
  SupportedVocabExerciseType,
  SynonymVocabExercise,
  TranslationMatchVocabExercise,
  VocabExerciseOption,
  VocabExerciseResult,
} from "@/types/vocab-exercises";

export type ExerciseType = SupportedVocabExerciseType;
export type ExerciseOption = VocabExerciseOption;
export type MeaningMatchExerciseData =
  | MeaningMatchVocabExercise
  | TranslationMatchVocabExercise;
export type FillBlankExerciseData = FillBlankVocabExercise;
export type ContextMeaningExerciseData = ContextMeaningVocabExercise;
export type SynonymExerciseData = SynonymVocabExercise;
export type CollocationExerciseData = CollocationVocabExercise;
export type Exercise = SupportedVocabExercise;
export type ExerciseResult = VocabExerciseResult;

export type ExerciseRendererProps<TExercise extends Exercise = Exercise> = {
  exercise: TExercise;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
  submitted: boolean;
};
