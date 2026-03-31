import { openai } from "@/lib/openai";

export type QuestionReasoningExplanation = {
  correct_answer: {
    option: "A" | "B" | "C" | "D";
    text: string;
  };
  why_correct: string;
  why_others_wrong: Array<{
    option: "A" | "B" | "C" | "D";
    text: string;
    reason: string;
  }>;
  thinking_tip: string;
};

type Choice = {
  option: "A" | "B" | "C" | "D";
  text: string;
};

function extractJsonObject(text: string): QuestionReasoningExplanation {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }

  return JSON.parse(text.slice(start, end + 1));
}

export function buildFallbackQuestionReasoningExplanation(input: {
  questionText: string;
  options: Choice[];
  correctOption: "A" | "B" | "C" | "D";
  questionExplanation?: string | null;
}): QuestionReasoningExplanation {
  const correctChoice =
    input.options.find((option) => option.option === input.correctOption) ?? input.options[0];

  const wrongChoices = input.options.filter((option) => option.option !== input.correctOption);

  return {
    correct_answer: {
      option: input.correctOption,
      text: correctChoice?.text ?? "",
    },
    why_correct:
      input.questionExplanation?.trim() ||
      "This choice fits the passage best when you focus on the author's full meaning, not just one word or phrase.",
    why_others_wrong: wrongChoices.map((choice) => ({
      option: choice.option,
      text: choice.text,
      reason:
        "This choice does not fit the passage as well. It is either too broad, too narrow, or misses the author's actual point.",
    })),
    thinking_tip:
      "Before choosing, restate the passage idea in your own words, then pick the answer that matches it most exactly.",
  };
}

export async function generateQuestionReasoningExplanation(input: {
  passageText: string;
  questionText: string;
  options: Choice[];
  correctOption: "A" | "B" | "C" | "D";
  questionExplanation?: string | null;
}) {
  const optionsBlock = input.options
    .map((choice) => `${choice.option}. ${choice.text}`)
    .join("\n");

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    input: `You are an expert SAT tutor.

Task:
Explain a multiple-choice reading question in a way that teaches the student how to think.

Requirements:
- Keep the explanation concise, practical, and student-friendly.
- Do not repeat the whole question.
- Do not use long paragraphs.
- Focus on passage meaning, not keyword matching.
- Explain every wrong answer briefly.

Return ONLY valid JSON with this exact shape:
{
  "correct_answer": {
    "option": "A",
    "text": "string"
  },
  "why_correct": "string",
  "why_others_wrong": [
    {
      "option": "B",
      "text": "string",
      "reason": "string"
    }
  ],
  "thinking_tip": "string"
}

Writing rules:
- why_correct: 1-2 sentences only
- each wrong-answer reason: 1 short sentence
- thinking_tip: 1 short strategy sentence
- Use reasons like: too broad, too narrow, contradicts the passage, misreads the context, partly true but not the best answer.

Passage:
${input.passageText}

Question:
${input.questionText}

Answer choices:
${optionsBlock}

Correct answer:
${input.correctOption}

Existing short explanation:
${input.questionExplanation?.trim() || "N/A"}`,
  });

  return extractJsonObject(response.output_text);
}
