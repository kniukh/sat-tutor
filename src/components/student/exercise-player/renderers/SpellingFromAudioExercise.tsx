"use client";

import AudioExercisePrompt from "../AudioExercisePrompt";
import type { ExerciseRendererProps, SpellingFromAudioExerciseData } from "../types";

export default function SpellingFromAudioExercise({
  exercise,
  selectedValue,
  onSelect,
  submitted,
}: ExerciseRendererProps<SpellingFromAudioExerciseData>) {
  return (
    <div className="space-y-3">
      <AudioExercisePrompt
        exercise={exercise}
        fallbackContent={
          <>
            Fallback prompt: type the word <span className="font-semibold">{exercise.target_word}</span>.
          </>
        }
      />

      <div>
        <input
          id={`spelling-input-${exercise.id}`}
          type="text"
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={submitted}
          value={selectedValue}
          onChange={(event) => onSelect(event.target.value)}
          placeholder={exercise.placeholder ?? "Type what you heard"}
          className="drill-input"
        />
      </div>
    </div>
  );
}
