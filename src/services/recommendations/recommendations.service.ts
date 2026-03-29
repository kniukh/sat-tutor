type LessonItem = {
  id: string;
  name: string;
  slug: string;
  lesson_type: string;
  status: string;
  display_order: number;
  unit_id: string;
};

type AnalyticsItem = {
  focusAreas: string[];
};

export function buildStudentRecommendations(params: {
  nextReadingLesson: LessonItem | null;
  analytics: AnalyticsItem;
  dueWordsCount: number;
}) {
  const primaryFocusArea = params.analytics.focusAreas[0] ?? null;

  return {
    nextLesson: params.nextReadingLesson,
    dueWordsCount: params.dueWordsCount,
    primaryFocusArea,
  };
}
