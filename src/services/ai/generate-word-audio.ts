import { openai } from '@/lib/openai';
import { logAiUsage } from "@/services/ai/ai-usage-log.service";
import fs from 'fs/promises';
import path from 'path';

export async function generateWordAudio(params: {
  text: string;
  itemType: 'word' | 'phrase';
  studentId?: string | null;
}) {
  const startedAt = Date.now();
  const model = "gpt-4o-mini-tts";
  let speech: Awaited<ReturnType<typeof openai.audio.speech.create>>;

  try {
    speech = await openai.audio.speech.create({
      model,
      voice: 'alloy',
      input: params.text,
    });
  } catch (error) {
    await logAiUsage({
      route: "vocabulary.generate_word_audio",
      model,
      studentId: params.studentId ?? null,
      latencyMs: Date.now() - startedAt,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown TTS error",
      metadata: {
        item_type: params.itemType,
        text_length: params.text.trim().length,
      },
    });

    throw error;
  }

  const buffer = Buffer.from(await speech.arrayBuffer());

  await logAiUsage({
    route: "vocabulary.generate_word_audio",
    model,
    studentId: params.studentId ?? null,
    totalTokens: params.text.trim().split(/\s+/).filter(Boolean).length,
    latencyMs: Date.now() - startedAt,
    status: "success",
    metadata: {
      item_type: params.itemType,
      text_length: params.text.trim().length,
      audio_bytes: buffer.byteLength,
    },
  });

  const safeName = params.text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const fileName = `${Date.now()}-${safeName || 'audio'}.mp3`;
  const dir = path.join(process.cwd(), 'public', 'audio', 'vocab');

  await fs.mkdir(dir, { recursive: true });

  const fullPath = path.join(dir, fileName);
  await fs.writeFile(fullPath, buffer);

  return `/audio/vocab/${fileName}`;
}
