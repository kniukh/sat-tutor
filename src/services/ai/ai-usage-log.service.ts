import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AiUsageLogPayload = {
  route: string;
  model: string;
  studentId?: string | null;
  actorType?: "student" | "admin" | "system";
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  latencyMs: number;
  cacheHit?: boolean;
  retryCount?: number;
  status?: "success" | "error";
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAiUsage(payload: AiUsageLogPayload) {
  try {
    const supabase = await createServerSupabaseClient();

    await supabase.from("ai_usage_log").insert({
      route: payload.route,
      model: payload.model,
      student_id: payload.studentId ?? null,
      actor_type:
        payload.actorType ?? (payload.studentId ? "student" : "system"),
      input_tokens: Math.max(0, Math.round(payload.inputTokens ?? 0)),
      output_tokens: Math.max(0, Math.round(payload.outputTokens ?? 0)),
      total_tokens: Math.max(0, Math.round(payload.totalTokens ?? 0)),
      cached_input_tokens: Math.max(0, Math.round(payload.cachedInputTokens ?? 0)),
      latency_ms: Math.max(0, Math.round(payload.latencyMs)),
      cache_hit: Boolean(payload.cacheHit),
      retry_count: Math.max(0, Math.round(payload.retryCount ?? 0)),
      status: payload.status ?? "success",
      error_message: payload.errorMessage ?? null,
      metadata: payload.metadata ?? {},
    });
  } catch (error) {
    console.warn(
      "AI usage log write skipped:",
      error instanceof Error ? error.message : "Unknown ai_usage_log error"
    );
  }
}
