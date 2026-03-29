import { openai } from "@/lib/openai";

type InputItem = {
  id: string;
  item_text: string;
};

type OutputItem = {
  id: string;
  audio_base64: string;
};

export async function generateVocabularyAudioBulk(
  items: InputItem[]
): Promise<OutputItem[]> {
  const results: OutputItem[] = [];

  for (const item of items) {
    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: item.item_text,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    results.push({
      id: item.id,
      audio_base64: buffer.toString("base64"),
    });
  }

  return results;
}