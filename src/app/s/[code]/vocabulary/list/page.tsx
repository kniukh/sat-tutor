import Link from "next/link";
import MyVocabularyPageClient from "@/components/student/MyVocabularyPageClient";
import {
  studentDashboardPath,
  studentVocabularyPath,
} from "@/lib/routes/student";
import { getStudentVocabularyListPageData } from "@/services/vocabulary/student-vocabulary.service";

export default async function StudentVocabularyListPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { code } = await params;
  const queryParams = await searchParams;
  const requestedPage = Number.parseInt(queryParams.page ?? "1", 10);
  const data = await getStudentVocabularyListPageData(code, {
    page: Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1,
    query: queryParams.q ?? "",
  });

  return (
    <div className="app-page-shell max-w-4xl space-y-4">
      <div className="flex flex-wrap gap-3">
        <Link href={studentVocabularyPath()} className="secondary-button">
          Back to Vocabulary Studio
        </Link>
        <Link href={studentDashboardPath()} className="secondary-button">
          Return to Dashboard
        </Link>
      </div>

      <MyVocabularyPageClient
        key={`${data.pagination.query}:${data.pagination.page}`}
        studentId={data.student.id}
        items={data.items}
        pagination={data.pagination}
      />
    </div>
  );
}
