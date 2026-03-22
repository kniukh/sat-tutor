import OpenAI from 'openai';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const openai = new OpenAI({
  apiKey: requireEnv('OPENAI_API_KEY'),
});