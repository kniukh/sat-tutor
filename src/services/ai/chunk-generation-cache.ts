import "server-only";

import { createHash } from "node:crypto";

import type {
  ChunkLessonAnalysis,
  ChunkLessonPackage,
} from "@/services/ai/generate-chunk-lesson-package";

export const CHUNK_PACKAGE_CACHE_VERSION = "2026-04-01-package-cache-v1";

export type StoredChunkPackageCache = {
  version: string;
  fingerprint: string;
  cachedAt: string;
  package: ChunkLessonPackage;
};

function normalizeFingerprintText(text: string) {
  return text.replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

export function computeChunkFingerprint(input: {
  passageText: string;
  sourceType?: string | null;
}) {
  return createHash("sha256")
    .update(`${String(input.sourceType ?? "book").toLowerCase()}::${normalizeFingerprintText(input.passageText)}`)
    .digest("hex");
}

export function buildStoredChunkPackageCache(
  fingerprint: string,
  pkg: ChunkLessonPackage
): StoredChunkPackageCache {
  return {
    version: CHUNK_PACKAGE_CACHE_VERSION,
    fingerprint,
    cachedAt: new Date().toISOString(),
    package: pkg,
  };
}

export function readStoredChunkPackageCache(
  value: unknown,
  fingerprint: string
): ChunkLessonPackage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const cache = value as Partial<StoredChunkPackageCache>;

  if (
    cache.version !== CHUNK_PACKAGE_CACHE_VERSION ||
    cache.fingerprint !== fingerprint ||
    !cache.package ||
    typeof cache.package !== "object"
  ) {
    return null;
  }

  return cache.package as ChunkLessonPackage;
}

export function extractCachedChunkAnalysis(
  source: Record<string, unknown> | null | undefined,
  fingerprint?: string | null
): ChunkLessonAnalysis | null {
  if (!source) {
    return null;
  }

  if (fingerprint && source.chunk_fingerprint && String(source.chunk_fingerprint) !== fingerprint) {
    return null;
  }

  const analysisMainIdea = String(source.analysis_main_idea ?? "").trim();
  const analysisStructure = String(source.analysis_structure ?? "").trim();
  const analyzerReason = String(source.analyzer_reason ?? "").trim();
  const inferencePoints = Array.isArray(source.analysis_inference_points)
    ? source.analysis_inference_points.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  if (!analysisMainIdea || !analysisStructure || !analyzerReason || inferencePoints.length === 0) {
    return null;
  }

  return {
    passage_role:
      source.passage_role === "assessment" || source.passage_role === "context" || source.passage_role === "bridge"
        ? source.passage_role
        : "assessment",
    question_strategy:
      source.question_strategy === "full_set" || source.question_strategy === "light_check" || source.question_strategy === "none"
        ? source.question_strategy
        : "full_set",
    recommended_question_count: Math.max(0, Number(source.recommended_question_count ?? 4)),
    recommended_question_types: Array.isArray(source.recommended_question_types)
      ? source.recommended_question_types.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    analyzer_reason: analyzerReason,
    analysis_main_idea: analysisMainIdea,
    analysis_structure: analysisStructure,
    analysis_inference_points: inferencePoints.slice(0, 4),
    difficulty_level:
      source.difficulty_level === "easy" || source.difficulty_level === "medium" || source.difficulty_level === "hard"
        ? source.difficulty_level
        : "medium",
    text_mode:
      source.text_mode === "narrative" ||
      source.text_mode === "dialogue" ||
      source.text_mode === "descriptive" ||
      source.text_mode === "analytical"
        ? source.text_mode
        : "narrative",
    vocab_density:
      source.vocab_density === "low" || source.vocab_density === "medium" || source.vocab_density === "high"
        ? source.vocab_density
        : "medium",
    phrase_density:
      source.phrase_density === "low" || source.phrase_density === "medium" || source.phrase_density === "high"
        ? source.phrase_density
        : "low",
    writing_prompt_worthy: Boolean(source.writing_prompt_worthy),
    recommended_vocab_questions_count: Math.max(0, Number(source.recommended_vocab_questions_count ?? 2)),
    recommended_vocab_target_words: Array.isArray(source.recommended_vocab_target_words)
      ? source.recommended_vocab_target_words.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    recommended_vocab_target_phrases: Array.isArray(source.recommended_vocab_target_phrases)
      ? source.recommended_vocab_target_phrases.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
  };
}
