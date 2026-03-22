import { StudentDashboard } from '@/components/student/StudentDashboard';
import { getStudentDashboard } from '@/services/progress/progress.service';

export default async function StudentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getStudentDashboard(code);

  return (
    <StudentDashboard
      studentName={data.student.full_name}
      lessonsCompleted={data.summary.lessonsCompleted}
      averageAccuracy={data.summary.averageAccuracy}
      studentCode={code}
      nextLesson={data.recommendations.nextLesson}
      dueWordsCount={data.recommendations.dueWordsCount}
      primaryFocusArea={data.recommendations.primaryFocusArea}
      bookProgress={data.bookProgress}
      gamification={data.gamification}
    />
  );
}