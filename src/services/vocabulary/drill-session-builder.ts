import type { SupportedVocabExercise } from "@/types/vocab-exercises";
import {
  adaptClozeDrillsToExercises,
  adaptMeaningDrillsToExercises,
  type ClozeDrillItem,
  type MeaningDrillItem,
} from "@/services/vocabulary/exercise-adapters";
import {
  buildVocabExerciseSession,
  type VocabExerciseSession,
} from "@/services/vocabulary/session-builder";

export type VocabDrillSessionMode = "default_review" | "weak_first" | "mixed";

type DrillSessionParams = {
  mode?: VocabDrillSessionMode;
  sessionSize?: number;
  seed?: string;
};

function buildDeterministicSeed(prefix: string, ids: string[]) {
  return `${prefix}:${ids.join("|")}`;
}

export function buildVocabDrillSessionFromExercises(
  exercises: SupportedVocabExercise[],
  params: DrillSessionParams = {}
): VocabExerciseSession {
  const {
    mode = "default_review",
    sessionSize,
    seed = buildDeterministicSeed(
      mode,
      exercises.map((exercise) => exercise.id)
    ),
  } = params;

  return buildVocabExerciseSession({
    exercises,
    mode,
    targetSize: sessionSize,
    seed,
  });
}

export function buildMeaningDrillSession(
  items: MeaningDrillItem[],
  params: DrillSessionParams = {}
): VocabExerciseSession {
  return buildVocabDrillSessionFromExercises(adaptMeaningDrillsToExercises(items), {
    ...params,
    seed:
      params.seed ??
      buildDeterministicSeed(
        `meaning:${params.mode ?? "default_review"}`,
        items.map((item) => item.wordProgressId)
      ),
  });
}

export function buildClozeDrillSession(
  items: ClozeDrillItem[],
  params: DrillSessionParams = {}
): VocabExerciseSession {
  return buildVocabDrillSessionFromExercises(adaptClozeDrillsToExercises(items), {
    ...params,
    seed:
      params.seed ??
      buildDeterministicSeed(
        `cloze:${params.mode ?? "default_review"}`,
        items.map((item) => item.wordProgressId)
      ),
  });
}
