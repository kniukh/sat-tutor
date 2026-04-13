import Link from "next/link";
import MyVocabularyPageClient from "@/components/student/MyVocabularyPageClient";
import {
  studentDashboardPath,
  studentVocabularyPath,
} from "@/lib/routes/student";
import { getStudentVocabularyListPageData } from "@/services/vocabulary/student-vocabulary.service";

export default async function StudentVocabularyListPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getStudentVocabularyListPageData(code);

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

      <MyVocabularyPageClient studentId={data.student.id} items={data.items} />
    </div>
  );
}
