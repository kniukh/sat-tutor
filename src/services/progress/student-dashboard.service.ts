import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStudentVocabularyAnalytics } from "@/services/analytics/vocabulary-analytics.service";
import { getStudentGamificationSnapshot } from "@/services/gamification/gamification.service";
import { getWeeklyLeaderboardForStudent } from "@/services/gamification/leaderboards.service";
import {
  generateReviewQueueForStudent,
  getNextReviewQueueCandidates,
  listActiveReviewQueueCandidates,
} from "@/services/vocabulary/review-queue.service";

export async function getStudentDashboardData(studentId: string) {
  const supabase = await createServerSupabaseClient();
  await generateReviewQueueForStudent({
    studentId,
    limit: 100,
  });

  const leaderboardPromise = getWeeklyLeaderboardForStudent(studentId).catch((error) => {
    console.warn(
      "Weekly leaderboard unavailable on dashboard:",
      error instanceof Error ? error.message : "Unknown leaderboard error"
    );
    return null;
  });

  const [
    skillResult,
    activePracticeQueueResult,
    practiceQueueResult,
    lessonAttemptsResult,
    bookProgressResult,
    gamificationResult,
    leaderboardResult,
  ] = await Promise.all([
    supabase
      .from("skill_mastery")
      .select("*")
      .eq("student_id", studentId)
      .order("accuracy", { ascending: true }),

    listActiveReviewQueueCandidates({
      studentId,
      limit: 100,
    }),

    getNextReviewQueueCandidates({
      studentId,
      limit: 8,
      dueOnly: false,
    }),

    supabase
      .from("lesson_attempts")
      .select(`
        id,
        lesson_id,
        score,
        total_questions,
        accuracy,
        completed_at,
        lessons (
          id,
          name,
          lesson_type
        )
      `)
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false })
      .limit(5),

    supabase
      .from("student_book_progress")
      .select(`
        *,
        source_documents (
          id,
          title,
          author
        )
      `)
      .eq("student_id", studentId)
      .order("last_opened_at", { ascending: false })
      .limit(3),

    getStudentGamificationSnapshot(studentId),
    leaderboardPromise,
  ]);

  if (skillResult.error) throw new Error(skillResult.error.message);
  if (lessonAttemptsResult.error) throw new Error(lessonAttemptsResult.error.message);
  if (bookProgressResult.error) throw new Error(bookProgressResult.error.message);
  const vocabularyAnalytics = await getStudentVocabularyAnalytics(studentId);

  const normalizedRecentLessons = (lessonAttemptsResult.data ?? []).map((item: any) => {
    const lessonsValue = item.lessons;
    let lessonData = null;

    if (Array.isArray(lessonsValue)) {
      lessonData = lessonsValue[0] ?? null;
    } else if (lessonsValue && typeof lessonsValue === "object") {
      lessonData = lessonsValue;
    }

    return {
      ...item,
      lessons: lessonData,
    };
  });

  return {
    weakestSkills: (skillResult.data ?? []).slice(0, 3),
    readyVocabularyCount: activePracticeQueueResult.length,
    readyVocabulary: practiceQueueResult ?? [],
    recentLessons: normalizedRecentLessons,
    currentBooks: bookProgressResult.data ?? [],
    gamification: gamificationResult ?? null,
    leaderboard: leaderboardResult ?? null,
    vocabularyAnalytics,
  };
}
