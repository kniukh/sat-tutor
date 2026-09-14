'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
  guidedAssignmentId = null,
}: {
  session: VocabExerciseSession;
  studentId: string;
  accessCode: string;
  focused?: boolean;
  guidedAssignmentId?: string | null;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRetryingSave, setIsRetryingSave] = useState(false);
  const pendingAttemptSavesRef = useRef<Set<Promise<void>>>(new Set());
  const failedAttemptResultsRef = useRef<Map<string, ExerciseResult>>(new Map());
  const captureLessonId =
    typeof (session.metadata as Record<string, unknown>)?.lesson_id === "string"
      ? ((session.metadata as Record<string, unknown>).lesson_id as string)
      : null;

  useEffect(() => {
    if (!isFinalizingReward && pendingAttemptSavesRef.current.size === 0) {
      return;
    }

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isFinalizingReward, completedResults.length]);

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
          readingAssignmentId: guidedAssignmentId,
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
        failedAttemptResultsRef.current.delete(result.client_attempt_id);
        setSaveError(null);

        return;
      }

      const persisted = await persistExerciseAttempt({
        studentId,
        result,
        exercise: sourceExercise,
      });

      const saved = persisted.attempt;
      if (saved) {
        failedAttemptResultsRef.current.delete(result.client_attempt_id);
        setSaveError(null);
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
    } catch (error: unknown) {
      console.error('Failed to persist vocab exercise attempt', error);
      failedAttemptResultsRef.current.set(result.client_attempt_id, result);
      setSaveError(error instanceof Error ? error.message : 'Progress was not saved.');
      throw error;
    }
  }

  async function retryFailedSaves() {
    const failedResults = Array.from(failedAttemptResultsRef.current.values());
    setIsRetryingSave(true);
    try {
      if (failedResults.length > 0) {
        await Promise.all(failedResults.map((result) => submitExerciseAttempt(result)));
      }
      if (done && completedResults.length > 0) {
        await Promise.all(
          completedResults.map((result) => submitExerciseAttempt(result))
        );
      }
      if (failedAttemptResultsRef.current.size === 0) {
        setSaveError(null);
        if (done) {
          const pendingSaves = Array.from(pendingAttemptSavesRef.current);
          if (pendingSaves.length > 0) {
            await Promise.allSettled(pendingSaves);
          }
          const scoredResults = completedResults.filter(
            (result) => !isAlreadyKnownResult(result)
          );
          const correctCount = scoredResults.filter((result) => result.is_correct).length;
          const reward = await finalizeCheckpoint({
            completedCount: scoredResults.length,
            correctCount,
            accuracy:
              scoredResults.length > 0
                ? Math.round((correctCount / scoredResults.length) * 100)
                : 0,
          });
          setRewardCredit(reward);
          setSessionXpEarned((prev) => prev + Math.max(0, Number(reward?.xp?.totalXp ?? 0)));
        }
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Checkpoint was not saved.");
    } finally {
      setIsRetryingSave(false);
    }
  }

  async function finalizeCheckpoint(params: {
    completedCount: number;
    correctCount: number;
    accuracy: number;
  }) {
    const retryDelaysMs = [0, 350, 900, 1_800];
    let lastError: unknown = null;

    for (const delayMs of retryDelaysMs) {
      if (delayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }

      try {
        return await finalizeVocabularySession({
          studentId,
          sessionId: session.session_id,
          sessionMode: session.mode,
          readingAssignmentId: guidedAssignmentId,
          ...params,
        });
      } catch (error) {
        lastError = error;
        const isAttemptSaveRace =
          error instanceof Error &&
          error.message.includes("attempts are still being saved");
        if (!isAttemptSaveRace) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  function handleExerciseComplete(result: ExerciseResult) {
    const pendingSave = submitExerciseAttempt(result);
    pendingAttemptSavesRef.current.add(pendingSave);
    void pendingSave.then(
      () => pendingAttemptSavesRef.current.delete(pendingSave),
      () => pendingAttemptSavesRef.current.delete(pendingSave)
    );

    startTransition(async () => {
      try {
        await pendingSave;
      } catch {
        // submitExerciseAttempt already exposes a persistent retry state in the UI.
      }
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
        if (failedAttemptResultsRef.current.size > 0) {
          setSaveError('Some answers were not saved. Retry before finishing the session.');
          return;
        }

        const reward = await finalizeCheckpoint({
          completedCount,
          correctCount,
          accuracy,
        });
        setRewardCredit(reward);
        setSessionXpEarned((prev) => prev + Math.max(0, Number(reward?.xp?.totalXp ?? 0)));
      } catch (error) {
        console.error('Failed to finalize vocabulary session reward', error);
        setSaveError(error instanceof Error ? error.message : 'Checkpoint was not saved.');
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
        {saveError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p>{saveError}</p>
            <button
              type="button"
              onClick={retryFailedSaves}
              disabled={isRetryingSave}
              className="mt-3 rounded-xl bg-rose-700 px-3 py-2 font-semibold text-white disabled:opacity-60"
            >
              {isRetryingSave ? 'Saving…' : 'Retry saving progress'}
            </button>
          </div>
        ) : null}
        <VocabularySessionResults
          session={session}
          results={completedResults}
          accessCode={accessCode}
          completionAction={completionAction}
          progressSignals={progressSignals}
          rewardCredit={rewardCredit}
          sessionGamification={sessionGamification}
          isRewardPending={isFinalizingReward || isRetryingSave}
          isCompletionBlocked={isFinalizingReward || isRetryingSave || Boolean(saveError)}
          focused={focused}
        />
      </div>
    );
  }

  return (
    <div>
      {saveError ? (
        <div
          role="alert"
          className="fixed inset-x-4 top-3 z-50 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-800 shadow-lg"
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={retryFailedSaves}
            disabled={isRetryingSave}
            className="shrink-0 rounded-xl bg-rose-700 px-3 py-2 font-semibold text-white disabled:opacity-60"
          >
            {isRetryingSave ? 'Saving…' : 'Retry'}
          </button>
        </div>
      ) : null}
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
          guided_assignment_id: guidedAssignmentId,
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
