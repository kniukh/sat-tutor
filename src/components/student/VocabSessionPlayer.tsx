'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ExercisePlayer,
  type ExerciseResult,
} from './exercise-player';
import VocabularySessionResults from './VocabularySessionResults';
import type { VocabExerciseSession } from '@/services/vocabulary/session-builder';
import { persistExerciseAttempt } from '@/services/vocabulary/exercise-attempt-client.service';
import { finalizeVocabularySession } from '@/services/vocabulary/session-complete-client.service';
import type {
  VocabularySessionProgressSignal,
  VocabularySessionRewardCredit,
} from '@/services/vocabulary/session-results.service';

export default function VocabSessionPlayer({
  session,
  studentId,
  accessCode,
  focused = false,
}: {
  session: VocabExerciseSession;
  studentId: string;
  accessCode: string;
  focused?: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();
  const [isFinalizingReward, startRewardTransition] = useTransition();
  const [completedResults, setCompletedResults] = useState<ExerciseResult[]>([]);
  const [progressSignals, setProgressSignals] = useState<VocabularySessionProgressSignal[]>([]);
  const [rewardCredit, setRewardCredit] = useState<VocabularySessionRewardCredit | null>(null);

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
        setProgressSignals((prev) => [
          ...prev,
          {
            exerciseId: result.exercise_id,
            targetWord: result.target_word ?? null,
            previousLifecycleState:
              typeof sourceExercise.reviewMeta?.lifecycleState === 'string'
                ? sourceExercise.reviewMeta.lifecycleState
                : null,
            nextLifecycleState: persisted.progress?.progressRow?.lifecycle_state ?? null,
            sameSessionCreditCapped: Boolean(persisted.progress?.sameSessionCreditCapped),
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

    const completedCount = results.length || session.metadata.actual_size;
    const correctCount = results.filter((result) => result.is_correct).length;
    const accuracy = completedCount > 0 ? Math.round((correctCount / completedCount) * 100) : 0;

    startRewardTransition(async () => {
      try {
        const reward = await finalizeVocabularySession({
          studentId,
          sessionId: session.session_id,
          sessionMode: session.mode,
          completedCount,
          correctCount,
          accuracy,
        });
        setRewardCredit(reward);
      } catch (error) {
        console.error('Failed to finalize vocabulary session reward', error);
      } finally {
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <VocabularySessionResults
          session={session}
          results={completedResults}
          accessCode={accessCode}
          progressSignals={progressSignals}
          rewardCredit={rewardCredit}
          isRewardPending={isFinalizingReward}
          focused={focused}
        />
      </div>
    );
  }

  return (
    <div>
      <ExercisePlayer
        exercises={session.ordered_exercises}
        sessionId={session.session_id}
        sessionMetadata={{ session_mode: session.mode }}
        focused={focused}
        captureStudentId={studentId}
        onExerciseComplete={handleExerciseComplete}
        onComplete={handleComplete}
      />
    </div>
  );
}
