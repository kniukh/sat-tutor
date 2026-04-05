import { openai } from "@/lib/openai";
import { logAiUsage } from "@/services/ai/ai-usage-log.service";

type InputItem = {
  id: string;
  item_text: string;
};

type OutputItem = {
  id: string;
  audio_base64: string;
};

export async function generateVocabularyAudioBulk(
  items: InputItem[],
  options?: {
    studentId?: string | null;
  }
): Promise<OutputItem[]> {
  const results: OutputItem[] = [];
  const model = "gpt-4o-mini-tts";

  for (const item of items) {
    const startedAt = Date.now();

    try {
      const response = await openai.audio.speech.create({
        model,
        voice: "alloy",
        input: item.item_text,
      });

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await logAiUsage({
        route: "vocabulary.generate_audio_bulk_item",
        model,
        studentId: options?.studentId ?? null,
        totalTokens: item.item_text.trim().split(/\s+/).filter(Boolean).length,
        latencyMs: Date.now() - startedAt,
        status: "success",
        metadata: {
          vocabulary_item_id: item.id,
          text_length: item.item_text.trim().length,
          audio_bytes: buffer.byteLength,
        },
      });

      results.push({
        id: item.id,
        audio_base64: buffer.toString("base64"),
      });
    } catch (error) {
      await logAiUsage({
        route: "vocabulary.generate_audio_bulk_item",
        model,
        studentId: options?.studentId ?? null,
        latencyMs: Date.now() - startedAt,
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Unknown TTS error",
        metadata: {
          vocabulary_item_id: item.id,
          text_length: item.item_text.trim().length,
        },
      });
    }
  }

  return results;
}
