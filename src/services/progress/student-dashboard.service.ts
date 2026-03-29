import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStudentVocabularyAnalytics } from "@/services/analytics/vocabulary-analytics.service";

export async function getStudentDashboardData(studentId: string) {
  const supabase = await createServerSupabaseClient();

  const today = new Date().toISOString().slice(0, 10);

  const [
    skillResult,
    vocabResult,
    lessonAttemptsResult,
    bookProgressResult,
    gamificationResult,
  ] = await Promise.all([
    supabase
      .from("skill_mastery")
      .select("*")
      .eq("student_id", studentId)
      .order("accuracy", { ascending: true }),

    supabase
      .from("word_progress")
      .select("*")
      .eq("student_id", studentId)
      .lte("next_review_date", today)
      .order("next_review_date", { ascending: true }),

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

    supabase
      .from("student_gamification")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  if (skillResult.error) throw new Error(skillResult.error.message);
  if (vocabResult.error) throw new Error(vocabResult.error.message);
  if (lessonAttemptsResult.error) throw new Error(lessonAttemptsResult.error.message);
  if (bookProgressResult.error) throw new Error(bookProgressResult.error.message);
  if (gamificationResult.error) throw new Error(gamificationResult.error.message);

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
    dueVocabulary: vocabResult.data ?? [],
    recentLessons: normalizedRecentLessons,
    currentBooks: bookProgressResult.data ?? [],
    gamification: gamificationResult.data ?? null,
    vocabularyAnalytics,
  };
}
