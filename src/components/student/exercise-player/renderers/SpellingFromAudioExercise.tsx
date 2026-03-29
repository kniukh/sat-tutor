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
    <div className="space-y-5">
      <AudioExercisePrompt
        exercise={exercise}
        title="Listen, then type the word."
        description="Use the audio, then spell the word exactly."
        readyHint="Use the audio, then type the word exactly."
        fallbackContent={
          <>
            Fallback prompt: type the word <span className="font-semibold">{exercise.target_word}</span>.
          </>
        }
        footer={null}
      />

      <div className="px-1">
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
          className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-lg font-medium text-slate-950 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>
    </div>
  );
}
