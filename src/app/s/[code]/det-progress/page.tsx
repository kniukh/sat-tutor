import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { studentDetReadingPath, studentDashboardPath } from "@/lib/routes/student";

export default async function DetProgressPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("access_code", code)
    .eq("is_active", true)
    .single();

  if (studentError || !student) throw new Error("Student not found");

  const { data: detLessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("content_mode", "det");
  const lessonIds = (detLessons ?? []).map((lesson) => lesson.id);

  const [{ data: metrics }, { data: attempts }] = await Promise.all([
    lessonIds.length
      ? supabase.from("lesson_reading_metrics").select("reading_duration_sec, words_per_minute").eq("student_id", student.id).eq("content_mode", "det").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as any[] }),
    lessonIds.length
      ? supabase.from("question_attempts").select("is_correct, question_type").eq("student_id", student.id).eq("content_mode", "det").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const metricRows = metrics ?? [];
  const attemptRows = attempts ?? [];
  const totalSeconds = metricRows.reduce((sum, row) => sum + Number(row.reading_duration_sec ?? 0), 0);
  const averageWpm = metricRows.length ? Math.round(metricRows.reduce((sum, row) => sum + Number(row.words_per_minute ?? 0), 0) / metricRows.length) : 0;
  const accuracy = attemptRows.length ? Math.round((attemptRows.filter((row) => row.is_correct).length / attemptRows.length) * 100) : 0;

  return (
    <div className="content-shell max-w-5xl space-y-6">
      <header className="coach-topbar">
        <div><div className="coach-eyebrow">DET Reading</div><h1 className="coach-page-title">Your progress</h1></div>
        <div className="flex gap-2"><Link href={studentDashboardPath()} className="coach-secondary-button">Dashboard</Link><Link href={studentDetReadingPath()} className="coach-primary-button">Read</Link></div>
      </header>
      <p className="coach-page-copy">{student.full_name}, track your speed and understanding of everyday English.</p>
      <section className="coach-stats" aria-label="DET progress">
        <div className="coach-stat"><span>Reading sessions</span><strong>{metricRows.length}</strong></div>
        <div className="coach-stat"><span>Average speed</span><strong>{averageWpm} WPM</strong></div>
        <div className="coach-stat"><span>Question accuracy</span><strong>{accuracy}%</strong></div>
        <div className="coach-stat"><span>Reading time</span><strong>{Math.round(totalSeconds / 60)} min</strong></div>
      </section>
      <section className="card-surface p-6">
        <div className="coach-eyebrow">DET focus</div>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">Keep building quick understanding</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your DET results are tracked separately from SAT Reading. Continue with short chunks and pay attention to meaning in context.</p>
      </section>
    </div>
  );
}
