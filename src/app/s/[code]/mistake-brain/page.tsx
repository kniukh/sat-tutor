import MistakeBrainPage from "@/components/student/MistakeBrainPage";
import { getMistakeBrainPageData } from "@/services/analytics/mistake-brain-page.service";

export default async function StudentMistakeBrainRoute({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getMistakeBrainPageData(code);

  return <MistakeBrainPage data={data} />;
}
