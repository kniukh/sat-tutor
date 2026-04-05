import { openai } from "@/lib/openai";
import { logAiUsage } from "@/services/ai/ai-usage-log.service";

type TrackedResponseParams = {
  model: string;
  route: string;
  input: string;
  studentId?: string | null;
  actorType?: "student" | "admin" | "system";
  retryCount?: number;
  metadata?: Record<string, unknown>;
};

function toTokenCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function readUsageMetric(source: unknown, key: string) {
  if (!source || typeof source !== "object") {
    return 0;
  }

  return toTokenCount((source as Record<string, unknown>)[key]);
}

function readCachedInputTokens(usage: unknown) {
  if (!usage || typeof usage !== "object") {
    return 0;
  }

  const details = (usage as Record<string, unknown>).input_tokens_details;
  return readUsageMetric(details, "cached_tokens");
}

export async function createTrackedResponse(params: TrackedResponseParams) {
  const startedAt = Date.now();

  try {
    const response = await openai.responses.create({
      model: params.model,
      input: params.input,
    });
    const latencyMs = Date.now() - startedAt;
    const usage = (response as unknown as { usage?: unknown }).usage;
    const cachedInputTokens = readCachedInputTokens(usage);

    await logAiUsage({
      route: params.route,
      model: params.model,
      studentId: params.studentId ?? null,
      actorType:
        params.actorType ?? (params.studentId ? "student" : "system"),
      inputTokens: readUsageMetric(usage, "input_tokens"),
      outputTokens: readUsageMetric(usage, "output_tokens"),
      totalTokens: readUsageMetric(usage, "total_tokens"),
      cachedInputTokens,
      latencyMs,
      cacheHit: cachedInputTokens > 0,
      retryCount: params.retryCount ?? 0,
      status: "success",
      metadata: params.metadata,
    });

    return response;
  } catch (error) {
    await logAiUsage({
      route: params.route,
      model: params.model,
      studentId: params.studentId ?? null,
      actorType:
        params.actorType ?? (params.studentId ? "student" : "system"),
      latencyMs: Date.now() - startedAt,
      cacheHit: false,
      retryCount: params.retryCount ?? 0,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown OpenAI error",
      metadata: params.metadata,
    });

    throw error;
  }
}
