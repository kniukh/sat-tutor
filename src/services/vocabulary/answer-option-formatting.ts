const WRAPPING_QUOTES_PATTERN = /^[`"'“”«»„]+|[`"'“”«»„]+$/g;
const TRAILING_PUNCTUATION_PATTERN = /[.!?;:,]+$/g;
const UPPERCASE_WORD_PATTERN = /^[A-ZА-ЯЁ]{2,}(?:[-/][A-ZА-ЯЁ]{2,})*$/u;
const TITLECASE_WORD_PATTERN = /^[A-ZА-ЯЁ][a-zа-яё'’-]+$/u;
const CAMEL_OR_INTERNAL_UPPERCASE_PATTERN = /^[A-ZА-ЯЁ][a-zа-яё]+[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё'’-]*$/u;
const FIRST_PERSON_PATTERN = /^I(?:['’].+)?$/u;

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function stripWrappingQuotes(text: string) {
  return text.replace(WRAPPING_QUOTES_PATTERN, "");
}

function stripTrailingPunctuation(text: string) {
  return text.replace(TRAILING_PUNCTUATION_PATTERN, "");
}

function extractLeadingWords(text: string, count: number) {
  return normalizeWhitespace(text)
    .split(/\s+/)
    .slice(0, count)
    .map((word) => word.replace(/^[^A-Za-zА-Яа-яЁё]+|[^A-Za-zА-Яа-яЁё]+$/gu, ""))
    .filter(Boolean);
}

function isLikelyProperNounOrName(text: string) {
  const words = extractLeadingWords(text, 2);
  const [firstWord, secondWord] = words;

  if (!firstWord) {
    return false;
  }

  if (FIRST_PERSON_PATTERN.test(firstWord)) {
    return true;
  }

  if (UPPERCASE_WORD_PATTERN.test(firstWord)) {
    return true;
  }

  if (CAMEL_OR_INTERNAL_UPPERCASE_PATTERN.test(firstWord)) {
    return true;
  }

  if (
    firstWord &&
    secondWord &&
    TITLECASE_WORD_PATTERN.test(firstWord) &&
    TITLECASE_WORD_PATTERN.test(secondWord)
  ) {
    return true;
  }

  return false;
}

function lowercaseFirstLetter(text: string) {
  const firstLetterIndex = text.search(/[A-Za-zА-Яа-яЁё]/u);
  if (firstLetterIndex < 0) {
    return text;
  }

  return (
    text.slice(0, firstLetterIndex) +
    text.charAt(firstLetterIndex).toLowerCase() +
    text.slice(firstLetterIndex + 1)
  );
}

export function normalizeAnswerOptionLabel(text: string | null | undefined) {
  const normalized = stripTrailingPunctuation(
    stripWrappingQuotes(normalizeWhitespace(text ?? ""))
  );

  if (!normalized) {
    return "";
  }

  if (isLikelyProperNounOrName(normalized)) {
    return normalized;
  }

  return lowercaseFirstLetter(normalized);
}

export function normalizeAnswerOptionCompare(text: string | null | undefined) {
  return normalizeAnswerOptionLabel(text).toLowerCase();
}

export function dedupeNormalizedAnswerOptions(
  values: Array<string | null | undefined>
) {
  const deduped = new Map<string, string>();

  for (const value of values) {
    const normalizedLabel = normalizeAnswerOptionLabel(value);
    const compareKey = normalizeAnswerOptionCompare(normalizedLabel);

    if (!normalizedLabel || !compareKey || deduped.has(compareKey)) {
      continue;
    }

    deduped.set(compareKey, normalizedLabel);
  }

  return Array.from(deduped.values());
}
