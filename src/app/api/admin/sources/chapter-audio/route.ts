import { NextResponse } from "next/server";
import { isAdminApiAuthError, requireAdminApi } from "@/lib/auth/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildEstimatedSentenceAlignments,
  buildSttSentenceAlignments,
  resolveChunkAudioWindow,
  type ChapterSentenceAlignment,
} from "@/services/content/chapter-audio-alignment";
import { transcribeChapterAudio } from "@/services/ai/transcribe-chapter-audio";

function getAudioExtension(fileName: string) {
  const extension = fileName.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? "";
  if ([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".webm"].includes(extension)) {
    return extension;
  }

  return ".mp3";
}

const MAX_CHAPTER_AUDIO_BYTES = 25 * 1024 * 1024;

async function saveAudioFile(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  buffer: Buffer;
  fileName: string;
  sourceDocumentId: string;
  chapterIndex: number;
}) {
  const extension = getAudioExtension(params.fileName);
  const objectPath = `chapter-audio/${params.sourceDocumentId}/chapter-${params.chapterIndex}${extension}`;
  const { error: uploadError } = await params.supabase.storage
    .from("audio")
    .upload(objectPath, params.buffer, {
      contentType: `audio/${extension === ".mp3" ? "mpeg" : extension.slice(1)}`,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Audio storage upload failed: ${uploadError.message}`);
  }

  return params.supabase.storage.from("audio").getPublicUrl(objectPath).data.publicUrl;
}

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    return await uploadChapterAudio(request);
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("chapter audio upload failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chapter audio upload failed",
      },
      { status: 500 },
    );
  }
}

async function uploadChapterAudio(request: Request) {

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

  if (audioFile.size === 0) {
    return NextResponse.json({ error: "The audio file is empty" }, { status: 400 });
  }

  if (audioFile.size > MAX_CHAPTER_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "The audio file is too large. Please use a file up to 25 MB." },
      { status: 413 },
    );
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
    supabase,
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

  const chapterSentenceAlignments: ChapterSentenceAlignment[] = alignments.map((sentence) => ({
    sentenceIndex: sentence.sentenceIndex,
    sentenceText: sentence.sentenceText,
    charStart: sentence.charStart,
    charEnd: sentence.charEnd,
    audioStartMs: sentence.audioStartMs,
    audioEndMs: sentence.audioEndMs,
    confidence: sentence.confidence,
    alignmentMethod: sentence.alignmentMethod,
  }));

  const { data: existingPassages, error: passagesError } = await supabase
    .from("generated_passages")
    .select("id, lesson_id, passage_text, chunk_index")
    .eq("source_document_id", sourceDocumentId)
    .eq("chapter_index", chapterIndex)
    .order("chunk_index", { ascending: true });

  if (passagesError) {
    return NextResponse.json({ error: passagesError.message }, { status: 500 });
  }

  let syncedPassagesCount = 0;
  for (const passage of existingPassages ?? []) {
    const audioWindow = resolveChunkAudioWindow({
      audioUrl,
      chunkText: String(passage.passage_text ?? ""),
      chapterSentences: chapterSentenceAlignments,
    });

    const { error: passageUpdateError } = await supabase
      .from("generated_passages")
      .update({
        audio_url: audioWindow.audioUrl,
        audio_start_ms: audioWindow.audioStartMs,
        audio_end_ms: audioWindow.audioEndMs,
        audio_sentence_start_index: audioWindow.sentenceStartIndex,
        audio_sentence_end_index: audioWindow.sentenceEndIndex,
        audio_sentence_timings: audioWindow.sentenceTimings,
        audio_alignment_confidence: audioWindow.confidence,
        audio_alignment_method: audioWindow.alignmentMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", passage.id);

    if (passageUpdateError) {
      return NextResponse.json({ error: passageUpdateError.message }, { status: 500 });
    }

    if (passage.lesson_id) {
      const { error: lessonPassageUpdateError } = await supabase
        .from("lesson_passages")
        .update({
          audio_url: audioWindow.audioUrl,
          audio_start_ms: audioWindow.audioStartMs,
          audio_end_ms: audioWindow.audioEndMs,
          audio_sentence_start_index: audioWindow.sentenceStartIndex,
          audio_sentence_end_index: audioWindow.sentenceEndIndex,
          audio_sentence_timings: audioWindow.sentenceTimings,
          audio_alignment_confidence: audioWindow.confidence,
          audio_alignment_method: audioWindow.alignmentMethod,
        })
        .eq("lesson_id", passage.lesson_id)
        .eq("is_primary", true);

      if (lessonPassageUpdateError) {
        return NextResponse.json({ error: lessonPassageUpdateError.message }, { status: 500 });
      }
    }

    syncedPassagesCount += 1;
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
    syncedPassagesCount,
  });
}
