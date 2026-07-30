import { createClient } from "@/lib/supabase/server";
import { getOrCreateLessonState } from "./lesson-state.service";
import { updateSkillTrackingForAttempt } from "@/services/analytics/skill-tracking.service";
import { runMistakeBrainForLesson } from "@/services/analytics/mistake-brain.service";
import { ensureLessonVocabularyDrillsReady } from "@/services/vocabulary/drill-preparation.service";
import { awardReadingLessonCompletionXp } from "@/services/gamification/xp-awards.service";
import { getLessonSequenceByCurrentLessonId } from "@/services/reading/reading.service";
import { updateStudentBookProgress } from "@/services/reading/book-progress.service";
import { LessonFlowError } from "./lesson-state.service";

export async function completeLesson(studentId: string, lessonId: string) {
  const supabase = await createClient();

  const state = await getOrCreateLessonState(studentId, lessonId);

  const { data: existingAttempt, error: existingAttemptError } = await supabase
    .from("lesson_attempts")
    .select("*")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .eq("completion_key", "primary")
    .maybeSingle();
  if (existingAttemptError) throw existingAttemptError;
  if (existingAttempt) {
    if (state.stage !== "completed") {
      await supabase
        .from("student_lesson_state")
        .update({ stage: "completed", updated_at: new Date().toISOString() })
        .eq("id", state.id);
    }
    return {
      ...existingAttempt,
      vocabularyPreparation: null,
      xpReward: null,
      deduplicated: true,
    };
  }

  if (state.stage !== "questions") {
    throw new LessonFlowError(
      `Cannot complete lesson while it is in ${state.stage} stage`,
      409
    );
  }

  const { data: questions, error: questionsError } = await supabase
    .from("question_bank")
    .select("id, correct_option, question_type")
    .eq("lesson_id", lessonId)
    .eq("review_status", "approved")
    .order("display_order", { ascending: true });

  if (questionsError) throw questionsError;

  if (!questions.length) {
    throw new LessonFlowError("Lesson has no approved questions", 409);
  }

  const answersMap = (state.question_answers_json ?? {}) as Record<
    string,
    {
      questionId: string;
      selectedOption: string | null;
      skill?: string | null;
      answeredAt: string;
    }
  >;
  const unansweredQuestionIds = questions
    .map((question) => question.id)
    .filter((questionId) => !answersMap[questionId]?.selectedOption);
  if (unansweredQuestionIds.length > 0) {
    throw new LessonFlowError(
      `Answer every question before completing the lesson (${unansweredQuestionIds.length} remaining)`,
      409
    );
  }

  const evaluatedAnswers = questions.map((question) => {
    const studentAnswer = answersMap[question.id];
    const selectedOption = studentAnswer?.selectedOption ?? null;
    const isCorrect = selectedOption === question.correct_option;

    return {
      questionId: question.id,
      selectedOption,
      correctOption: question.correct_option,
      isCorrect,
      skill: question.question_type,
    };
  });

  const score = evaluatedAnswers.filter((a) => a.isCorrect).length;
  const totalQuestions = evaluatedAnswers.length;
  const accuracy = totalQuestions ? score / totalQuestions : 0;

  const weakSkills = buildWeakSkills(evaluatedAnswers);

  const { data: attempt, error: attemptError } = await supabase
    .from("lesson_attempts")
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      score,
      total_questions: totalQuestions,
      accuracy,
      weak_skills: weakSkills,
      answers_json: evaluatedAnswers,
      completed_at: new Date().toISOString(),
      completion_key: "primary",
    })
    .select()
    .single();

  if (attemptError) {
    if (attemptError.code === "23505") {
      const { data: racedAttempt, error: racedAttemptError } = await supabase
        .from("lesson_attempts")
        .select("*")
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId)
        .eq("completion_key", "primary")
        .single();
      if (racedAttemptError) throw racedAttemptError;
      return {
        ...racedAttempt,
        vocabularyPreparation: null,
        xpReward: null,
        deduplicated: true,
      };
    }
    throw attemptError;
  }

  const { error: stateError } = await supabase
    .from("student_lesson_state")
    .update({
      stage: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId);

  if (stateError) throw stateError;

  const [bookProgressResult, xpRewardResult] = await Promise.allSettled([
    (async () => {
      const lessonSequence = await getLessonSequenceByCurrentLessonId(lessonId);
      return updateStudentBookProgress({
        studentId,
        lessonId,
        currentLessonId: lessonSequence.nextLesson?.id ?? null,
      });
    })(),
    awardReadingLessonCompletionXp({
      studentId,
      lessonId,
      lessonAttemptId: attempt.id,
      totalQuestions,
      accuracy,
    }),
  ]);

  if (bookProgressResult.status === "rejected") {
    console.error(
      "Book progress update failed after lesson completion",
      bookProgressResult.reason
    );
  }
  if (xpRewardResult.status === "rejected") {
    console.error("Reading lesson XP reward failed", xpRewardResult.reason);
  }
  const xpReward = xpRewardResult.status === "fulfilled" ? xpRewardResult.value : null;

  void (async () => {
    try {
      await updateSkillTrackingForAttempt(studentId, evaluatedAnswers);
    } catch (error) {
      console.error("Skill tracking failed after lesson completion", error);
    }

    try {
      await runMistakeBrainForLesson({ studentId, lessonId });
    } catch (error) {
      console.error("Mistake Brain failed", error);
    }

    try {
      await ensureLessonVocabularyDrillsReady({
        studentId,
        lessonId,
      });
    } catch (error) {
      console.error("Vocabulary drill preparation failed after lesson completion", error);
    }
  })();

  return {
    ...attempt,
    vocabularyPreparation: null,
    xpReward,
  };
}

function buildWeakSkills(
  answers: Array<{ skill: string; isCorrect: boolean }>
) {
  const grouped: Record<string, { total: number; correct: number }> = {};

  for (const answer of answers) {
    if (!grouped[answer.skill]) {
      grouped[answer.skill] = { total: 0, correct: 0 };
    }
    grouped[answer.skill].total += 1;
    if (answer.isCorrect) grouped[answer.skill].correct += 1;
  }

  return Object.entries(grouped)
    .map(([skill, value]) => ({
      skill,
      accuracy: value.total ? value.correct / value.total : 0,
    }))
    .filter((item) => item.accuracy < 0.7);
}
