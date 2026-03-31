import MistakeReplayPlayer from "@/components/student/MistakeReplayPlayer";
import { getMistakeReplaySessionData } from "@/services/analytics/mistake-replay.service";

export default async function StudentMistakeReplayRoute({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getMistakeReplaySessionData(code);

  return <MistakeReplayPlayer data={data} />;
}
