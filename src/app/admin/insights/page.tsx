import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { getAiUsageByStudentReport } from "@/services/analytics/ai-usage-by-student.service";
import { getAllStudentsSkillDashboard } from "@/services/analytics/skill-dashboard.service";
import { getWeeklyVocabularyForAllStudents } from "@/services/vocabulary/weekly-vocabulary.service";

export default async function AdminInsightsPage() {
  await requireAdmin();

  const [skillRows, weeklyVocabulary, aiUsageReport] = await Promise.all([
    getAllStudentsSkillDashboard(),
    getWeeklyVocabularyForAllStudents(),
    getAiUsageByStudentReport(),
  ]);

  const skillStudentCount = new Set(
    skillRows.map((item: any) => item.student_id).filter(Boolean)
  ).size;
  const vocabStudentCount = new Set(
    weeklyVocabulary.map((item: any) => item.student_id).filter(Boolean)
  ).size;

  const stats = [
    { label: "Skill Rows", value: skillRows.length },
    { label: "Students in Skills", value: skillStudentCount },
    { label: "Weekly Captures", value: weeklyVocabulary.length },
    { label: "Students in Vocab", value: vocabStudentCount },
    { label: "AI Requests", value: aiUsageReport.summary.totalRequests },
    { label: "Students Using AI", value: aiUsageReport.summary.trackedStudents },
  ];

  const sections = [
    {
      title: "Skill Tracking",
      href: "/admin/skills",
      description: "Reading performance by skill area across all students.",
      value: `${skillRows.length} records`,
      cta: "Open Skill Tracking",
    },
    {
      title: "Weekly Vocabulary",
      href: "/admin/vocabulary",
      description: "Recently captured words and weekly vocabulary activity.",
      value: `${weeklyVocabulary.length} recent captures`,
      cta: "Open Weekly Vocabulary",
    },
    {
      title: "AI Usage by Student",
      href: "/admin/insights/ai-usage",
      description:
        "Per-student token usage, request volume, cache hit rate, and recent AI activity.",
      value: `${aiUsageReport.summary.totalTokens.toLocaleString("en-US")} tokens · ${aiUsageReport.summary.cacheHitRate}% cache hit`,
      cta: "Open AI Usage",
    },
  ];

  return (
    <AdminShell title="Insights" subtitle="Analytics and learning signals live here, not on the general admin overview.">
      <AdminStatsGrid items={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="card-surface p-5 sm:p-6">
            <div className="app-kicker">{section.title}</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
            <div className="mt-4 text-base font-semibold text-slate-950">{section.value}</div>
            <div className="mt-5">
              <Link href={section.href} className="primary-button">
                {section.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
