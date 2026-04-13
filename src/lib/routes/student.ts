function appendQuery(pathname: string, query?: Record<string, string | null | undefined>) {
  if (!query) {
    return pathname;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.length > 0) {
      searchParams.set(key, value);
    }
  }

  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function studentDashboardPath() {
  return "/s";
}

export function studentLibraryPath() {
  return "/s/book";
}

export function studentBookLibraryPath() {
  return studentLibraryPath();
}

export function studentBookDetailPath(sourceDocumentId: string) {
  return `/s/book/${sourceDocumentId}`;
}

export function studentLessonPath(lessonId: string, accessCode?: string | null) {
  if (accessCode) {
    return `/s/${accessCode}/lesson/${lessonId}`;
  }

  return `/s/lesson/${lessonId}`;
}

export function studentVocabularyPath(query?: Record<string, string | null | undefined>) {
  return appendQuery("/s/vocabulary", query);
}

export function studentVocabularyListPath(query?: Record<string, string | null | undefined>) {
  return appendQuery("/s/vocabulary/list", query);
}

export function studentVocabularyDrillPath(query?: Record<string, string | null | undefined>) {
  return appendQuery("/s/vocabulary/drill", query);
}

export function studentProgressPath() {
  return "/s/progress";
}

export function studentMistakeBrainPath() {
  return "/s/mistake-brain";
}
