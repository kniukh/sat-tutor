import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildStudentAnalytics } from '@/services/analytics/analytics.service';
import { buildStudentRecommendations } from '@/services/recommendations/recommendations.service';
import { getNextReadingLessonForStudent } from '@/services/reading/reading.service';
import { getStudentBookProgress } from '@/services/reading/book-progress.service';
import { getOrCreateStudentGamification } from '@/services/gamification/gamification.service';

export async function getStudentDashboard(studentCode: string) {
  const supabase = createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('access_code', studentCode)
    .eq('is_active', true)
    .single();

  if (studentError) {
    throw studentError;
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from('lesson_attempts')
    .select('*')
    .eq('student_id', student.id)
    .order('completed_at', { ascending: false });

  if (attemptsError) {
    throw attemptsError;
  }

  const attemptsList = attempts ?? [];
  const analytics = buildStudentAnalytics(attemptsList);

  const today = new Date().toISOString().slice(0, 10);

  const { count: dueWordsCount, error: dueWordsError } = await supabase
    .from('word_progress')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', student.id)
    .lte('next_review_date', today);

  if (dueWordsError) {
    throw dueWordsError;
  }

  const nextReadingLesson = await getNextReadingLessonForStudent(student.id);
  const bookProgress = await getStudentBookProgress(student.id);
  const gamification = await getOrCreateStudentGamification(student.id);

  const recommendations = buildStudentRecommendations({
    nextReadingLesson,
    analytics,
    dueWordsCount: dueWordsCount ?? 0,
  });

  return {
    student,
    attempts: attemptsList,
    summary: {
      lessonsCompleted: attemptsList.length,
      averageAccuracy: analytics.averageAccuracy,
    },
    analytics,
    recommendations,
    bookProgress,
    gamification,
  };
}