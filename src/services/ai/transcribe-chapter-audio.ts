import { toFile } from "openai";
import { openai } from "@/lib/openai";
import type { TranscriptWordTimestamp } from "@/services/content/chapter-audio-alignment";

type ChapterAudioTranscriptionResult = {
  text: string;
  words: TranscriptWordTimestamp[];
};

function sanitizeTranscriptionWords(words: unknown): TranscriptWordTimestamp[] {
  if (!Array.isArray(words)) {
    return [];
  }

  return words
    .map((word) => {
      if (!word || typeof word !== "object") {
        return null;
      }

      const record = word as Record<string, unknown>;
      const text = typeof record.word === "string" ? record.word.trim() : "";
      const start = typeof record.start === "number" ? record.start : Number(record.start);
      const end = typeof record.end === "number" ? record.end : Number(record.end);

      if (!text || !Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }

      return {
        word: text,
        start,
        end,
      };
    })
    .filter((word): word is TranscriptWordTimestamp => Boolean(word));
}

export async function transcribeChapterAudio(params: {
  audioBytes: Buffer;
  fileName: string;
  prompt?: string | null;
}): Promise<ChapterAudioTranscriptionResult> {
  const file = await toFile(params.audioBytes, params.fileName);
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1",
    language: "en",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    temperature: 0,
    prompt:
      params.prompt?.trim() ||
      "This is an audiobook chapter. Transcribe the spoken English as accurately as possible.",
  });

  return {
    text: typeof transcription.text === "string" ? transcription.text : "",
    words: sanitizeTranscriptionWords((transcription as { words?: unknown }).words),
  };
}
