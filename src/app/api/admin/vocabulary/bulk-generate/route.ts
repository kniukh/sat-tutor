import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  runVocabularyGoldContentBulkGeneration,
  type VocabularyGoldContentBulkMode,
} from "@/services/vocabulary/vocabulary-gold-content-bulk.service";

function isAuthorizedAdminSession(value: string | undefined) {
  return value === "authorized";
}

function sanitizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function sanitizeMode(value: unknown): VocabularyGoldContentBulkMode {
  return value === "full_regenerate" ? "full_regenerate" : "repair_missing";
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!isAuthorizedAdminSession(cookieStore.get("sat_admin_session")?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const words = sanitizeStringArray((body as Record<string, unknown>).words);
  const vocabularyItemIds = sanitizeStringArray(
    (body as Record<string, unknown>).vocabularyItemIds
  );

  if (words.length === 0 && vocabularyItemIds.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one word or vocabularyItemId" },
      { status: 400 }
    );
  }

  try {
    const result = await runVocabularyGoldContentBulkGeneration({
      words,
      vocabularyItemIds,
      translationLanguage:
        typeof (body as Record<string, unknown>).translationLanguage === "string"
          ? ((body as Record<string, unknown>).translationLanguage as string)
          : "ru",
      batchSize:
        typeof (body as Record<string, unknown>).batchSize === "number"
          ? ((body as Record<string, unknown>).batchSize as number)
          : 50,
      limit:
        typeof (body as Record<string, unknown>).limit === "number"
          ? ((body as Record<string, unknown>).limit as number)
          : null,
      dryRun: (body as Record<string, unknown>).dryRun !== false,
      mode: sanitizeMode((body as Record<string, unknown>).mode),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("admin vocab bulk-generate error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk generation failed" },
      { status: 500 }
    );
  }
}
