import type { VocabExerciseSession } from "@/services/vocabulary/session-builder";
import type { AdaptiveSessionSelectionSummary } from "@/services/vocabulary/adaptive-session-selection.service";

const EXERCISE_TYPE_LABELS = {
  meaning_match: "Meaning",
  pair_match: "Pairs",
  listen_match: "Listen",
  spelling_from_audio: "Spell",
  sentence_builder: "Build",
  error_detection: "Error",
  fill_blank: "Fill Blank",
  context_meaning: "Context",
  synonym: "Synonym",
  collocation: "Collocation",
} as const;

const ADAPTIVE_BUCKET_LABELS = {
  weak_recent: "Weak / Recent",
  reinforcement: "Reinforcement",
  newer_words: "Newer Words",
  retention_check: "Retention",
} as const;

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
} as const;

export default function VocabularySessionDevSummary({
  session,
  adaptiveSelection,
}: {
  session: VocabExerciseSession;
  adaptiveSelection: AdaptiveSessionSelectionSummary | null;
}) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Dev Session Mix
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Verify that the real student session is mixing the expected exercise types.
          </div>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          {session.session_id}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Object.entries(EXERCISE_TYPE_LABELS).map(([type, label]) => (
          <div
            key={type}
            className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {label}
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {session.metadata.counts_by_type[
                type as keyof typeof session.metadata.counts_by_type
              ] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(DIFFICULTY_LABELS).map(([band, label]) => (
          <div
            key={band}
            className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {label} Lane
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {session.metadata.counts_by_difficulty[
                band as keyof typeof session.metadata.counts_by_difficulty
              ] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Session Sequence
        </div>
        {session.metadata.sequence_debug.slice(0, 8).map((item) => (
          <div
            key={item.exercise_id}
            className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-950">
                {item.index}. {item.target_word}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {item.exercise_type}
                </span>
                {item.adaptive_difficulty_band ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                    {item.adaptive_difficulty_band}
                  </span>
                ) : null}
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {item.triggered_by}
                </span>
              </div>
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {item.selection_reason ?? "No selection reason recorded."}
            </div>
            {item.adaptive_difficulty_reason ? (
              <div className="mt-2 text-xs leading-5 text-slate-500">
                {item.adaptive_difficulty_reason}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {adaptiveSelection ? (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Adaptive Selection
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Rule-based mix used to decide which words and modalities entered this run.
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              target {adaptiveSelection.targetSize}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(ADAPTIVE_BUCKET_LABELS).map(([bucket, label]) => (
              <div
                key={bucket}
                className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {adaptiveSelection.countsByBucket[
                    bucket as keyof typeof adaptiveSelection.countsByBucket
                  ] ?? 0}
                  <span className="ml-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    / {adaptiveSelection.targetMix[
                      bucket as keyof typeof adaptiveSelection.targetMix
                    ]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Difficulty Bias
            </div>
            <div className="mt-2 text-lg font-semibold capitalize text-slate-950">
              {adaptiveSelection.difficultyProfile.bias}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {adaptiveSelection.difficultyProfile.reason}
            </div>
          </div>

          <div className="space-y-2">
            {adaptiveSelection.selectedWords.slice(0, 6).map((item) => (
              <div
                key={item.wordId}
                className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">{item.word}</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {item.bucket.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {item.preferredModality}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {item.selectionRule}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                      {item.adaptiveDifficultyBand}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">
                  {item.adaptiveDifficultyReason}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
