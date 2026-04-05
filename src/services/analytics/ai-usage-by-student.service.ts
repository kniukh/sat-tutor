import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type AiUsageLogRow = {
  student_id: string | null;
  actor_type: "student" | "admin" | "system";
  route: string;
  total_tokens: number;
  cached_input_tokens: number;
  cache_hit: boolean;
  latency_ms: number;
  status: string;
  created_at: string;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  access_code: string | null;
  is_active: boolean | null;
};

export type AiUsageByStudentRow = {
  studentId: string | null;
  studentName: string;
  accessCode: string;
  isActive: boolean;
  requestCount: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheHitCount: number;
  cacheHitRate: number;
  successCount: number;
  successRate: number;
  averageLatencyMs: number;
  lastRequestAt: string | null;
  lastRoute: string | null;
};

export type AiUsageByStudentSummary = {
  totalRequests: number;
  totalTokens: number;
  cacheHitRate: number;
  trackedStudents: number;
  averageLatencyMs: number;
  unattributedRequests: number;
};

export type AiUsageByStudentReport = {
  summary: AiUsageByStudentSummary;
  students: AiUsageByStudentRow[];
};

function createEmptyUsageRow(student: StudentRow): AiUsageByStudentRow {
  return {
    studentId: student.id,
    studentName: student.full_name ?? "Unnamed student",
    accessCode: student.access_code ?? "-",
    isActive: Boolean(student.is_active),
    requestCount: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    cacheHitCount: 0,
    cacheHitRate: 0,
    successCount: 0,
    successRate: 0,
    averageLatencyMs: 0,
    lastRequestAt: null,
    lastRoute: null,
  };
}

function finalizeUsageRow(row: AiUsageByStudentRow) {
  row.cacheHitRate =
    row.requestCount > 0 ? Math.round((row.cacheHitCount / row.requestCount) * 100) : 0;
  row.successRate =
    row.requestCount > 0 ? Math.round((row.successCount / row.requestCount) * 100) : 0;
  row.averageLatencyMs =
    row.requestCount > 0 ? Math.round(row.averageLatencyMs / row.requestCount) : 0;
}

export async function getAiUsageByStudentReport(): Promise<AiUsageByStudentReport> {
  const supabase = await createServerSupabaseClient();

  const [studentsResult, usageResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, access_code, is_active")
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_usage_log")
      .select(
        "student_id, actor_type, route, total_tokens, cached_input_tokens, cache_hit, latency_ms, status, created_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  if (studentsResult.error) {
    throw new Error(studentsResult.error.message);
  }

  if (usageResult.error) {
    throw new Error(usageResult.error.message);
  }

  const studentMap = new Map<string, AiUsageByStudentRow>();
  const students = (studentsResult.data ?? []) as StudentRow[];

  students.forEach((student) => {
    studentMap.set(student.id, createEmptyUsageRow(student));
  });

  const unattributedRow: AiUsageByStudentRow = {
    studentId: null,
    studentName: "System / Admin",
    accessCode: "-",
    isActive: true,
    requestCount: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    cacheHitCount: 0,
    cacheHitRate: 0,
    successCount: 0,
    successRate: 0,
    averageLatencyMs: 0,
    lastRequestAt: null,
    lastRoute: null,
  };

  const usageRows = (usageResult.data ?? []) as AiUsageLogRow[];
  let totalRequests = 0;
  let totalTokens = 0;
  let cacheHits = 0;
  let latencySum = 0;

  usageRows.forEach((usage) => {
    const row =
      usage.student_id && studentMap.has(usage.student_id)
        ? studentMap.get(usage.student_id)
        : unattributedRow;

    if (!row) {
      return;
    }

    row.requestCount += 1;
    row.totalTokens += Number(usage.total_tokens ?? 0);
    row.cachedInputTokens += Number(usage.cached_input_tokens ?? 0);
    row.averageLatencyMs += Number(usage.latency_ms ?? 0);

    if (usage.cache_hit) {
      row.cacheHitCount += 1;
      cacheHits += 1;
    }

    if (usage.status === "success") {
      row.successCount += 1;
    }

    if (!row.lastRequestAt || usage.created_at > row.lastRequestAt) {
      row.lastRequestAt = usage.created_at;
      row.lastRoute = usage.route;
    }

    totalRequests += 1;
    totalTokens += Number(usage.total_tokens ?? 0);
    latencySum += Number(usage.latency_ms ?? 0);
  });

  const rows = [...studentMap.values(), unattributedRow].filter(
    (row) => row.requestCount > 0 || row.studentId !== null
  );

  rows.forEach(finalizeUsageRow);

  rows.sort((left, right) => {
    if (right.totalTokens !== left.totalTokens) {
      return right.totalTokens - left.totalTokens;
    }

    return right.requestCount - left.requestCount;
  });

  return {
    summary: {
      totalRequests,
      totalTokens,
      cacheHitRate:
        totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0,
      trackedStudents: rows.filter(
        (row) => row.studentId !== null && row.requestCount > 0
      ).length,
      averageLatencyMs: totalRequests > 0 ? Math.round(latencySum / totalRequests) : 0,
      unattributedRequests: unattributedRow.requestCount,
    },
    students: rows,
  };
}
