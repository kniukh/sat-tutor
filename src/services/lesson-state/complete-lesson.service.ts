import { createClient } from "@/lib/supabase/server";
import { getOrCreateLessonState } from "./lesson-state.service";
import { updateSkillTrackingForAttempt } from "@/services/analytics/skill-tracking.service";
import { runMistakeBrainForLesson } from "@/services/analytics/mistake-brain.service";
import { ensureLessonVocabularyDrillsReady } from "@/services/vocabulary/drill-preparation.service";
import { awardReadingLessonCompletionXp } from "@/services/gamification/xp-awards.service";

export async function completeLesson(studentId: string, lessonId: string) {
  const supabase = await createClient();

  const state = await getOrCreateLessonState(studentId, lessonId);

  const { data: questions, error: questionsError } = await supabase
    .from("question_bank")
    .select("id, correct_option, question_type")
    .eq("lesson_id", lessonId)
    .order("display_order", { ascending: true });

  if (questionsError) throw questionsError;

  const answersMap = (state.question_answers_json ?? {}) as Record<
    string,
    {
      questionId: string;
      selectedOption: string | null;
      skill?: string | null;
      answeredAt: string;
    }
  >;

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
    })
    .select()
    .single();

  if (attemptError) throw attemptError;

  const { error: stateError } = await supabase
    .from("student_lesson_state")
    .update({
      stage: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId);

  if (stateError) throw stateError;

  await updateSkillTrackingForAttempt(studentId, evaluatedAnswers);

  try {
    await runMistakeBrainForLesson({ studentId, lessonId });
  } catch (error) {
    console.error("Mistake Brain failed", error);
  }

  let vocabularyPreparation = null;
  let xpReward = null;

  try {
    vocabularyPreparation = await ensureLessonVocabularyDrillsReady({
      studentId,
      lessonId,
    });
  } catch (error) {
    console.error("Vocabulary drill preparation failed after lesson completion", error);
  }

  try {
    xpReward = await awardReadingLessonCompletionXp({
      studentId,
      lessonId,
      lessonAttemptId: attempt.id,
      totalQuestions,
      accuracy,
    });
  } catch (error) {
    console.error("Reading lesson XP reward failed", error);
  }

  return {
    ...attempt,
    vocabularyPreparation,
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
