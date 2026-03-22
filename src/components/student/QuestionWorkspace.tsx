'use client';

import { useState } from 'react';
import LessonPlayer from '@/components/student/LessonPlayer';
import LessonProgressHud from '@/components/student/LessonProgressHud';

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  question_type: string;
};

export default function QuestionWorkspace({
  lessonId,
  studentId,
  questions,
  partLabel,
  stage,
  collectedWordsCount,
  initialAnswers,
  initialQuestionIndex,
}: {
  lessonId: string;
  studentId: string;
  questions: Question[];
  partLabel?: string | null;
  stage: string;
  collectedWordsCount: number;
  initialAnswers?: Record<string, 'A' | 'B' | 'C' | 'D'>;
  initialQuestionIndex?: number;
}) {
  const [progress, setProgress] = useState({
    totalQuestions: questions.length,
    answeredQuestions: Object.keys(initialAnswers ?? {}).length,
  });

  return (
    <div className="space-y-4">
      <LessonProgressHud
        partLabel={partLabel}
        stage={stage}
        collectedWordsCount={collectedWordsCount}
        totalQuestions={progress.totalQuestions}
        answeredQuestions={progress.answeredQuestions}
      />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Questions</h2>

        <LessonPlayer
          lessonId={lessonId}
          studentId={studentId}
          questions={questions}
          onProgressChange={setProgress}
          initialAnswers={initialAnswers}
          initialQuestionIndex={initialQuestionIndex}
        />
      </div>
    </div>
  );
}