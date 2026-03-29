import { openai } from '@/lib/openai';
import fs from 'fs/promises';
import path from 'path';

export async function generateWordAudio(params: {
  text: string;
  itemType: 'word' | 'phrase';
}) {
  const speech = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
    input: params.text,
  });

  const buffer = Buffer.from(await speech.arrayBuffer());

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
