'use client';

import { useMemo } from 'react';
import { VocabularyReviewExerciseShell } from './exercise-player';
import {
  type ClozeDrillItem,
} from '@/services/vocabulary/exercise-adapters';
import {
  buildClozeDrillSession,
  type VocabDrillSessionMode,
} from '@/services/vocabulary/drill-session-builder';

export default function ClozeDrillPlayer({
  items,
  sessionMode = 'default_review',
  sessionSize,
  sessionSeed,
}: {
  items: ClozeDrillItem[];
  sessionMode?: VocabDrillSessionMode;
  sessionSize?: number;
  sessionSeed?: string;
}) {
  const session = useMemo(
    () =>
      buildClozeDrillSession(items, {
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
      title="Context Cloze Drill"
      emptyMessage="No cloze items available."
      completeTitle="Cloze drill complete"
      completeDescription="Your review results were saved."
    />
  );
}
