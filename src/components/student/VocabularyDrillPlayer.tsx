'use client';

import { useMemo } from 'react';
import { VocabularyReviewExerciseShell } from './exercise-player';
import {
  type MeaningDrillItem,
} from '@/services/vocabulary/exercise-adapters';
import {
  buildMeaningDrillSession,
  type VocabDrillSessionMode,
} from '@/services/vocabulary/drill-session-builder';

export default function VocabularyDrillPlayer({
  items,
  sessionMode = 'default_review',
  sessionSize,
  sessionSeed,
}: {
  items: MeaningDrillItem[];
  sessionMode?: VocabDrillSessionMode;
  sessionSize?: number;
  sessionSeed?: string;
}) {
  const session = useMemo(
    () =>
      buildMeaningDrillSession(items, {
        mode: sessionMode,
        sessionSize,
        seed: sessionSeed,
      }),
    [items, sessionMode, sessionSeed, sessionSize]
  );

  return (
    <VocabularyReviewExerciseShell
      items={items}
      exercises={session.ordered_exercises}
      session={session}
      title="Vocabulary Drill"
      emptyMessage="No drill items available."
      completeTitle="Drill complete"
      completeDescription="Your vocabulary review has been updated."
    />
  );
}
