'use client';

import { useEffect } from 'react';

export default function ReadingProgressTracker({
  studentId,
  lessonId,
}: {
  studentId: string;
  lessonId: string;
}) {
  useEffect(() => {
    fetch('/api/reading/open-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, lessonId }),
    }).catch(() => {});
  }, [studentId, lessonId]);

  return null;
}
