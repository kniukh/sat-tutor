import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildEstimatedSentenceAlignments,
  buildSttSentenceAlignments,
} from "@/services/content/chapter-audio-alignment";
import { transcribeChapterAudio } from "@/services/ai/transcribe-chapter-audio";

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getAudioExtension(fileName: string) {
  const extension = path.extname(fileName || "").toLowerCase();
  if ([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".webm"].includes(extension)) {
    return extension;
  }

  return ".mp3";
}

async function saveAudioFile(params: {
  buffer: Buffer;
  fileName: string;
  sourceDocumentId: string;
  chapterIndex: number;
}) {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "chapter-audio");
  await fs.mkdir(uploadDir, { recursive: true });

  const baseName = safeSlug(`${params.sourceDocumentId}-chapter-${params.chapterIndex}`);
  const extension = getAudioExtension(params.fileName);
  const fileName = `${Date.now()}-${baseName}${extension}`;
  const fullPath = path.join(uploadDir, fileName);
  await fs.writeFile(fullPath, params.buffer);

  return `/uploads/chapter-audio/${fileName}`;
}

export async function POST(request: Request) {
  await requireAdmin();

  const formData = await request.formData();
  const sourceDocumentId = String(formData.get("sourceDocumentId") ?? "").trim();
  const chapterIndex = Number(formData.get("chapterIndex"));
  const durationMsRaw = Number(formData.get("durationMs"));
  const audioFile = formData.get("audioFile");

  if (!sourceDocumentId || !Number.isFinite(chapterIndex)) {
    return NextResponse.json(
      { error: "sourceDocumentId and chapterIndex are required" },
      { status: 400 }
    );
  }

  if (!(audioFile instanceof File)) {
    return NextResponse.json({ error: "audioFile is required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: chapter, error: chapterError } = await supabase
    .from("source_document_clean_text")
    .select("source_document_id, chapter_index, chapter_title, clean_text")
    .eq("source_document_id", sourceDocumentId)
    .eq("chapter_index", chapterIndex)
    .maybeSingle();

  if (chapterError || !chapter) {
    return NextResponse.json(
      { error: chapterError?.message ?? "Chapter clean text not found" },
      { status: 404 }
    );
  }

  const audioBytes = Buffer.from(await audioFile.arrayBuffer());
  const audioUrl = await saveAudioFile({
    buffer: audioBytes,
    fileName: audioFile.name,
    sourceDocumentId,
    chapterIndex,
  });
  const durationMs = Number.isFinite(durationMsRaw) && durationMsRaw > 0
    ? Math.round(durationMsRaw)
    : null;
  const estimatedAlignments = buildEstimatedSentenceAlignments({
    chapterText: String(chapter.clean_text ?? ""),
    audioDurationMs: durationMs,
  });
  let alignments = estimatedAlignments;
  let transcriptionText: string | null = null;
  let transcriptionWordsCount = 0;
  let alignmentMethod = durationMs ? "estimated_by_word_count" : "sentence_only";

  try {
    const transcription = await transcribeChapterAudio({
      audioBytes,
      fileName: audioFile.name || `chapter-${chapterIndex}.mp3`,
      prompt: String(chapter.clean_text ?? "").slice(0, 1200),
    });

    transcriptionText = transcription.text;
    transcriptionWordsCount = transcription.words.length;

    if (transcription.words.length > 0) {
      alignments = buildSttSentenceAlignments({
        chapterText: String(chapter.clean_text ?? ""),
        transcriptWords: transcription.words,
        fallbackDurationMs: durationMs,
      });
      alignmentMethod = "stt_word_timestamps";
    }
  } catch (error) {
    console.error("chapter audio STT alignment failed; using estimated alignment", error);
  }

  const { error: deleteError } = await supabase
    .from("source_chapter_audio_sentences")
    .delete()
    .eq("source_document_id", sourceDocumentId)
    .eq("chapter_index", chapterIndex);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (alignments.length > 0) {
    const { error: insertError } = await supabase
      .from("source_chapter_audio_sentences")
      .insert(
        alignments.map((sentence) => ({
          source_document_id: sourceDocumentId,
          chapter_index: chapterIndex,
          sentence_index: sentence.sentenceIndex,
          sentence_text: sentence.sentenceText,
          char_start: sentence.charStart,
          char_end: sentence.charEnd,
          audio_start_ms: sentence.audioStartMs,
          audio_end_ms: sentence.audioEndMs,
          confidence: sentence.confidence,
          alignment_method: sentence.alignmentMethod,
        }))
      );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase
    .from("source_document_clean_text")
    .update({
      audio_url: audioUrl,
      audio_status:
        alignmentMethod === "stt_word_timestamps"
          ? "aligned_stt"
          : durationMs
            ? "aligned_estimated"
            : "sentences_ready",
      audio_duration_ms: durationMs,
      audio_alignment_method: alignmentMethod,
      audio_aligned_at: new Date().toISOString(),
    })
    .eq("source_document_id", sourceDocumentId)
    .eq("chapter_index", chapterIndex);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    audioUrl,
    durationMs,
    sentencesCount: alignments.length,
    alignmentMethod,
    transcriptionWordsCount,
    transcriptionText,
  });
}
