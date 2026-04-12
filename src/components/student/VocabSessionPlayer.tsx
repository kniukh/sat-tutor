'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ExercisePlayer,
  type ExerciseResult,
} from './exercise-player';
import VocabularySessionResults from './VocabularySessionResults';
import type { VocabExerciseSession } from '@/services/vocabulary/session-builder';
import { persistExerciseAttempt } from '@/services/vocabulary/exercise-attempt-client.service';
import { finalizeVocabularySession } from '@/services/vocabulary/session-complete-client.service';
import { markVocabularyWordAlreadyKnown } from '@/services/vocabulary/already-know-client.service';
import type {
  VocabularySessionProgressSignal,
  VocabularySessionGamificationSummary,
  VocabularySessionRewardCredit,
} from '@/services/vocabulary/session-results.service';

type FloatingReward = {
  id: string;
  xp: number;
  comboCount: number;
  comboMultiplier: number;
  leveledUp: boolean;
};

export default function VocabSessionPlayer({
  session,
  studentId,
  accessCode,
  focused = false,
  completionAction = null,
}: {
  session: VocabExerciseSession;
  studentId: string;
  accessCode: string;
  focused?: boolean;
  completionAction?: {
    href: string;
    label: string;
  } | null;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();
  const [isFinalizingReward, startRewardTransition] = useTransition();
  const [completedResults, setCompletedResults] = useState<ExerciseResult[]>([]);
  const [progressSignals, setProgressSignals] = useState<VocabularySessionProgressSignal[]>([]);
  const [rewardCredit, setRewardCredit] = useState<VocabularySessionRewardCredit | null>(null);
  const [sessionXpEarned, setSessionXpEarned] = useState(0);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [floatingReward, setFloatingReward] = useState<FloatingReward | null>(null);
  const pendingAttemptSavesRef = useRef<Set<Promise<void>>>(new Set());
  const captureLessonId =
    typeof (session.metadata as Record<string, unknown>)?.lesson_id === "string"
      ? ((session.metadata as Record<string, unknown>).lesson_id as string)
      : null;

  function isAlreadyKnownResult(result: ExerciseResult) {
    return Boolean(result.metadata?.already_known);
  }

  async function submitExerciseAttempt(result: ExerciseResult) {
    const retrySourceExerciseId =
      typeof result.metadata?.retry_source_exercise_id === "string"
        ? result.metadata.retry_source_exercise_id
        : null;
    const sourceExercise = session.ordered_exercises.find(
      (exercise) =>
        exercise.id === result.exercise_id ||
        exercise.id === retrySourceExerciseId
    );
    if (!sourceExercise) return;

    try {
      if (isAlreadyKnownResult(result)) {
        const progress = await markVocabularyWordAlreadyKnown({
          studentId,
          wordId: sourceExercise.target_word_id ?? sourceExercise.targetWordId ?? null,
          word: sourceExercise.target_word ?? sourceExercise.targetWord ?? "",
          lessonId:
            sourceExercise.reviewMeta?.sourceLessonId ??
            result.lesson_id ??
            captureLessonId,
          sessionId: result.session_id,
          sessionMode: session.mode,
        });

        setProgressSignals((prev) => [
          ...prev,
          {
            exerciseId: result.exercise_id,
            targetWord: result.target_word ?? null,
            previousLifecycleState:
              typeof sourceExercise.reviewMeta?.lifecycleState === 'string'
                ? sourceExercise.reviewMeta.lifecycleState
                : null,
            nextLifecycleState: progress?.progressRow?.lifecycle_state ?? null,
            sameSessionCreditCapped: false,
          },
        ]);

        return;
      }

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

        const xpReward = persisted.xpReward;
        const xpAwarded = Math.max(0, Number(xpReward?.xpAwarded ?? 0));
        const comboCount = Math.max(
          0,
          Number(xpReward?.breakdown?.comboCountAfter ?? (result.is_correct ? currentCombo + 1 : 0))
        );
        const comboMultiplier = Number(xpReward?.breakdown?.comboMultiplier ?? 1);
        const leveledUp = Boolean(xpReward?.progress?.leveledUp);

        setSessionXpEarned((prev) => prev + xpAwarded);
        setCurrentCombo(result.is_correct ? comboCount : 0);
        setMaxCombo((prev) => Math.max(prev, result.is_correct ? comboCount : prev));

        if (xpAwarded > 0) {
          const rewardId = `${result.exercise_id}-${Date.now()}`;
          setFloatingReward({
            id: rewardId,
            xp: xpAwarded,
            comboCount,
            comboMultiplier,
            leveledUp,
          });
          window.setTimeout(() => {
            setFloatingReward((current) => (current?.id === rewardId ? null : current));
          }, 1600);
        }

        if (process.env.NODE_ENV !== 'production') {
          console.debug('Saved vocab exercise attempt', {
            attempt: saved,
            progress: persisted.progress,
            progressError: persisted.progressError,
            xpReward: persisted.xpReward,
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to persist vocab exercise attempt', error);
    }
  }

  function handleExerciseComplete(result: ExerciseResult) {
    const pendingSave = submitExerciseAttempt(result);
    pendingAttemptSavesRef.current.add(pendingSave);
    pendingSave.finally(() => {
      pendingAttemptSavesRef.current.delete(pendingSave);
    });

    startTransition(async () => {
      await pendingSave;
    });
  }

  function handleComplete(results: ExerciseResult[]) {
    setCompletedResults(results);
    setDone(true);

    const scoredResults = results.filter((result) => !isAlreadyKnownResult(result));
    const completedCount = scoredResults.length;
    const correctCount = scoredResults.filter((result) => result.is_correct).length;
    const accuracy = completedCount > 0 ? Math.round((correctCount / completedCount) * 100) : 0;

    startRewardTransition(async () => {
      try {
        const pendingSaves = Array.from(pendingAttemptSavesRef.current);
        if (pendingSaves.length > 0) {
          await Promise.allSettled(pendingSaves);
        }

        const reward = await finalizeVocabularySession({
          studentId,
          sessionId: session.session_id,
          sessionMode: session.mode,
          completedCount,
          correctCount,
          accuracy,
        });
        setRewardCredit(reward);
        setSessionXpEarned((prev) => prev + Math.max(0, Number(reward?.xp?.totalXp ?? 0)));
      } catch (error) {
        console.error('Failed to finalize vocabulary session reward', error);
      } finally {
        router.refresh();
      }
    });
  }

  if (done) {
    const wordsImprovedCount = new Set(
      progressSignals
        .filter(
          (signal) =>
            Boolean(signal.targetWord) &&
            Boolean(signal.nextLifecycleState) &&
            signal.previousLifecycleState !== signal.nextLifecycleState
        )
        .map((signal) => signal.targetWord)
    ).size;
    const sessionGamification: VocabularySessionGamificationSummary = {
      totalXpEarned: sessionXpEarned,
      maxCombo,
      wordsImprovedCount,
      leveledUp: Boolean(rewardCredit?.progress?.leveledUp),
      previousLevel: rewardCredit?.progress?.previousLevel ?? null,
      currentLevel: rewardCredit?.progress?.currentLevel ?? rewardCredit?.gamification?.level ?? null,
    };

    return (
      <div className="space-y-4">
        <VocabularySessionResults
          session={session}
          results={completedResults}
          accessCode={accessCode}
          completionAction={completionAction}
          progressSignals={progressSignals}
          rewardCredit={rewardCredit}
          sessionGamification={sessionGamification}
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
        sessionMetadata={{
          session_mode: session.mode,
          session_phase: session.metadata.session_phase,
          extended_practice_mode: session.metadata.extended_practice_mode,
          session_checkpoint_index: session.metadata.checkpoint_index,
          continuation_available: session.metadata.continuation_available,
          continuation_source_counts: session.metadata.continuation_source_counts,
        }}
        focused={focused}
        captureStudentId={studentId}
        captureLessonId={captureLessonId}
        comboCount={currentCombo}
        floatingReward={floatingReward}
        onExerciseComplete={handleExerciseComplete}
        onComplete={handleComplete}
      />
    </div>
  );
}
