'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AttemptTelemetryDebug,
  ExercisePlayer,
  type ExerciseResult,
} from './exercise-player';
import VocabularySessionResults from './VocabularySessionResults';
import type { VocabExerciseSession } from '@/services/vocabulary/session-builder';
import { persistExerciseAttempt } from '@/services/vocabulary/exercise-attempt-client.service';
import type { ExerciseAttemptRow } from '@/types/vocab-tracking';

type PersistDebugItem = {
  exerciseId: string;
  status: 'saved' | 'failed';
  timestamp: string;
  attemptId?: string;
  message?: string;
  lifecycleState?: string | null;
  masteryScore?: number | null;
};

function getModeCopy(mode: VocabExerciseSession['mode']) {
  if (mode === 'review_weak_words') {
    return {
      title: 'Weak word recovery',
      description:
        'This session leans into recent misses, weak-again words, and urgent reinforcement before broadening out.',
    };
  }

  if (mode === 'learn_new_words') {
    return {
      title: 'New word builder',
      description:
        'Start with easier meaning work, then move toward context and retention.',
    };
  }

  return {
    title: 'Mixed vocabulary practice',
    description:
      'Move through one question at a time, keep a steady rhythm, and let the review queue adapt as you go.',
  };
}

export default function VocabSessionPlayer({
  session,
  studentId,
  accessCode,
}: {
  session: VocabExerciseSession;
  studentId: string;
  accessCode: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [savedAttempts, setSavedAttempts] = useState<ExerciseAttemptRow[]>([]);
  const [completedResults, setCompletedResults] = useState<ExerciseResult[]>([]);
  const [persistLog, setPersistLog] = useState<PersistDebugItem[]>([]);
  const modeCopy = getModeCopy(session.mode);
  const failedSaves = persistLog.filter((item) => item.status === 'failed').length;
  const progressWarnings = persistLog.filter(
    (item) => item.status === 'saved' && Boolean(item.message)
  ).length;

  async function submitExerciseAttempt(result: ExerciseResult) {
    const sourceExercise = session.ordered_exercises.find(
      (exercise) => exercise.id === result.exercise_id
    );
    if (!sourceExercise) return;

    try {
      const persisted = await persistExerciseAttempt({
        studentId,
        result,
        exercise: sourceExercise,
      });

      const saved = persisted.attempt;
      if (saved) {
        setSavedAttempts((prev) => [...prev, saved]);
        setPersistLog((prev) => [
          ...prev,
          {
            exerciseId: result.exercise_id,
            status: 'saved',
            timestamp: new Date().toISOString(),
            attemptId: saved.id,
            lifecycleState: persisted.progress?.progressRow?.lifecycle_state ?? null,
            masteryScore: persisted.progress?.progressRow?.mastery_score ?? null,
            message: persisted.progressError ?? undefined,
          },
        ]);

        if (process.env.NODE_ENV !== 'production') {
          console.debug('Saved vocab exercise attempt', {
            attempt: saved,
            progress: persisted.progress,
            progressError: persisted.progressError,
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to persist vocab exercise attempt', error);
      setPersistLog((prev) => [
        ...prev,
        {
          exerciseId: result.exercise_id,
          status: 'failed',
          timestamp: new Date().toISOString(),
          message: error?.message ?? 'Unknown error',
        },
      ]);
    }
  }

  function handleExerciseComplete(result: ExerciseResult) {
    startTransition(async () => {
      await submitExerciseAttempt(result);
    });
  }

  function handleComplete(results: ExerciseResult[]) {
    setCompletedResults(results);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="space-y-4">
        <VocabularySessionResults
          session={session}
          results={completedResults}
          accessCode={accessCode}
        />

        {process.env.NODE_ENV !== 'production' ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-700">
            Saved attempts: {savedAttempts.length} · Failed saves: {failedSaves} · Progress warnings:{' '}
            {progressWarnings}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 text-white shadow-sm">
        <div className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Live Session
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {modeCopy.title}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-white/75">
                {modeCopy.description}
              </p>
            </div>

            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
              {session.mode.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Exercises
              </div>
              <div className="mt-2 text-2xl font-semibold">{session.metadata.actual_size}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Unique Words
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {session.metadata.unique_target_words}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Saved Attempts
              </div>
              <div className="mt-2 text-2xl font-semibold">{savedAttempts.length}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                Sync Status
              </div>
              <div className="mt-2 text-sm font-semibold">
                {isSaving ? 'Saving latest answer...' : 'Up to date'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ExercisePlayer
        exercises={session.ordered_exercises}
        title="Vocabulary Session"
        onExerciseComplete={handleExerciseComplete}
        onComplete={handleComplete}
      />

      <AttemptTelemetryDebug
        title="Persistence Debug"
        summary={[
          { label: 'Session ID', value: session.session_id },
          { label: 'Saving', value: isSaving ? 'yes' : 'no' },
          { label: 'Saved Rows', value: savedAttempts.length },
          { label: 'Failed Saves', value: failedSaves },
          { label: 'Progress Warnings', value: progressWarnings },
        ]}
        payload={persistLog}
      />
    </div>
  );
}
