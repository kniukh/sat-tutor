import { openai } from "@/lib/openai";
import { QUESTION_QUALITY_CONFIG } from "@/services/ai/question-generation-config";

function summarizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown validation error");
  const compact = message.replace(/\s+/g, " ").trim();
  const maxLength = QUESTION_QUALITY_CONFIG.retry.maxFeedbackLength;

  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

export async function runAiGenerationWithRetry<T>(params: {
  label: string;
  prompt: string;
  parseAndValidate: (text: string) => T;
  model?: string;
  maxAttempts?: number;
}) {
  const model = params.model ?? "gpt-5";
  const maxAttempts = Math.max(1, params.maxAttempts ?? QUESTION_QUALITY_CONFIG.retry.maxAttempts);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const retryBlock =
      attempt === 1 || !lastError
        ? ""
        : `

Retry instructions:
- The previous attempt failed validation for this reason: ${summarizeError(lastError)}
- Rewrite the FULL response from scratch.
- Preserve the exact required JSON shape.
- Fix the failed quality or formatting issue directly instead of making a small patch.
`;

    const response = await openai.responses.create({
      model,
      input: `${params.prompt}${retryBlock}`,
    });

    try {
      return params.parseAndValidate(response.output_text);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${params.label} failed after ${maxAttempts} attempt(s): ${summarizeError(lastError)}`
  );
}
