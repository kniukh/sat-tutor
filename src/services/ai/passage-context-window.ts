import "server-only";

const SENTENCE_END_ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "mt.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "u.s.",
  "u.k.",
]);

function collapseWhitespace(text: string) {
  return text.replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

function shouldMergeSentenceBoundary(current: string, next: string) {
  const tail = current.trim().toLowerCase();
  if (!tail || !next.trim()) {
    return false;
  }

  const lastToken = tail.split(/\s+/).pop() ?? "";
  if (SENTENCE_END_ABBREVIATIONS.has(lastToken)) {
    return true;
  }

  if (/^[a-z]\.$/i.test(lastToken)) {
    return true;
  }

  return false;
}

function splitIntoSentences(text: string) {
  const rawSentences =
    text.match(/[^.!?]+(?:[.!?]+["'”’)\]]*)?|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];

  if (rawSentences.length <= 1) {
    return rawSentences;
  }

  const merged: string[] = [];

  for (const sentence of rawSentences) {
    const previous = merged[merged.length - 1];
    if (previous && shouldMergeSentenceBoundary(previous, sentence)) {
      merged[merged.length - 1] = `${previous} ${sentence}`.replace(/\s+/g, " ").trim();
      continue;
    }

    merged.push(sentence);
  }

  return merged;
}

function extractSearchTokens(...values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) =>
          String(value ?? "")
            .toLowerCase()
            .match(/[a-z][a-z'-]{2,}/g) ?? []
        )
        .filter((token) => token.length >= 3)
    )
  );
}

function scoreSentence(sentence: string, queryTokens: string[], correctText?: string | null) {
  const sentenceLower = sentence.toLowerCase();
  const overlap = queryTokens.reduce((score, token) => {
    return sentenceLower.includes(token) ? score + 1 : score;
  }, 0);

  const exactCorrectBoost =
    correctText && sentenceLower.includes(correctText.toLowerCase()) ? 2 : 0;

  return overlap + exactCorrectBoost;
}

function getSentenceWindowRadius(questionType: string) {
  if (questionType.includes("main")) {
    return 2;
  }

  if (questionType.includes("inference")) {
    return 2;
  }

  return 1;
}

export function buildPassageExcerptForQuestion(input: {
  passageText: string;
  questionType?: string | null;
  questionText: string;
  correctText?: string | null;
  selectedText?: string | null;
  maxChars?: number;
}) {
  const normalizedPassage = collapseWhitespace(input.passageText);

  if (!normalizedPassage) {
    return "";
  }

  if (normalizedPassage.length <= (input.maxChars ?? 900)) {
    return normalizedPassage;
  }

  const sentences = splitIntoSentences(normalizedPassage);
  if (sentences.length <= 3) {
    return normalizedPassage;
  }

  const queryTokens = extractSearchTokens(
    input.questionText,
    input.correctText,
    input.selectedText
  );

  const ranked = sentences
    .map((sentence, index) => ({
      index,
      score: scoreSentence(sentence, queryTokens, input.correctText),
    }))
    .sort((left, right) => right.score - left.score);

  const bestIndex = ranked[0]?.index ?? 0;
  const radius = getSentenceWindowRadius(String(input.questionType ?? ""));
  const start = Math.max(0, bestIndex - radius);
  const end = Math.min(sentences.length, bestIndex + radius + 1);
  let excerpt = sentences.slice(start, end).join(" ").trim();
  const maxChars = input.maxChars ?? 900;

  if (excerpt.length > maxChars) {
    excerpt = excerpt.slice(0, maxChars).trim();
  }

  return excerpt || normalizedPassage.slice(0, maxChars).trim();
}
