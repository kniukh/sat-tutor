import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";

export default async function AdminPage() {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();

  const [
    studentsResult,
    lessonsResult,
    sourcesResult,
    skillRowsResult,
    vocabularyRowsResult,
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
    supabase.from("source_documents").select("*", { count: "exact", head: true }),
    supabase.from("skill_mastery").select("*", { count: "exact", head: true }),
    supabase
      .from("vocabulary_capture_events")
      .select("*", { count: "exact", head: true }),
  ]);

  if (studentsResult.error) throw new Error(studentsResult.error.message);
  if (lessonsResult.error) throw new Error(lessonsResult.error.message);
  if (sourcesResult.error) throw new Error(sourcesResult.error.message);
  if (skillRowsResult.error) throw new Error(skillRowsResult.error.message);
  if (vocabularyRowsResult.error) throw new Error(vocabularyRowsResult.error.message);

  const stats = [
    { label: "Students", value: studentsResult.count ?? 0 },
    { label: "Insights Rows", value: skillRowsResult.count ?? 0 },
    { label: "Lessons", value: lessonsResult.count ?? 0 },
    { label: "Sources", value: sourcesResult.count ?? 0 },
    { label: "Vocab Captures", value: vocabularyRowsResult.count ?? 0 },
  ];

  const sections = [
    {
      label: "Students",
      href: "/admin/students",
      description: "Student accounts, access codes, and individual management.",
    },
    {
      label: "Insights",
      href: "/admin/insights",
      description: "Skill tracking, vocabulary analytics, and learning signals.",
    },
    {
      label: "Content",
      href: "/admin/lessons",
      description: "Lesson creation, editing, publishing, and review.",
    },
    {
      label: "Sources",
      href: "/admin/sources",
      description: "Books, uploads, and raw source material for generation.",
    },
  ];

  return (
    <AdminShell title="Overview" subtitle="A simple control surface for the four core admin sections.">
      <AdminStatsGrid items={stats} />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <Link
            key={section.label}
            href={section.href}
            className="card-surface p-5 transition hover:bg-[var(--color-surface-muted)]"
          >
            <div className="app-kicker">{section.label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-950">{section.label}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{section.description}</div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
