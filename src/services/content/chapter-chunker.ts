export type ChunkedChapterPassage = {
  chapterIndex: number;
  chapterTitle: string | null;
  chunkIndexWithinChapter: number;
  passageText: string;
  wordCount: number;
};

function normalizeInlineWhitespace(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeParagraphBlock(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .split(/\n+/)
    .map((line) => normalizeInlineWhitespace(line))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeStandaloneParagraph(line: string) {
  return countWords(line) >= 12 || line.length >= 80;
}

function startsLikeParagraph(line: string) {
  return /^[A-Z"'“‘(\[]/.test(line);
}

function endsSentence(line: string) {
  return /[.!?]["'”’)\]]*$/.test(line);
}

export function normalizeChunkPassageText(text: string) {
  const paragraphs = splitIntoParagraphs(text);
  return paragraphs.join('\n\n').trim();
}

function splitIntoParagraphs(text: string) {
  const normalized = text.replace(/\r/g, '').trim();

  if (!normalized) {
    return [];
  }

  const paragraphBlocks = normalized
    .split(/\n\s*\n/)
    .map((p) => normalizeParagraphBlock(p))
    .filter(Boolean);

  if (paragraphBlocks.length > 1) {
    return paragraphBlocks;
  }

  const lines = normalized
    .split(/\n+/)
    .map((line) => normalizeInlineWhitespace(line))
    .filter(Boolean);

  if (lines.length <= 1) {
    return [normalizeParagraphBlock(normalized)];
  }

  const rebuiltParagraphs: string[] = [];
  let currentLines: string[] = [];

  function flushParagraph() {
    const paragraph = currentLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!paragraph) return;
    rebuiltParagraphs.push(paragraph);
    currentLines = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? null;

    currentLines.push(line);

    if (!nextLine) {
      flushParagraph();
      continue;
    }

    const currentParagraphText = currentLines.join(' ');
    const currentWords = countWords(currentParagraphText);
    const shouldBreak =
      endsSentence(line) &&
      (
        (currentWords >= 18 && startsLikeParagraph(nextLine) && looksLikeStandaloneParagraph(nextLine)) ||
        currentWords >= 90
      );

    if (shouldBreak) {
      flushParagraph();
    }
  }

  return rebuiltParagraphs.length > 0 ? rebuiltParagraphs : [normalizeParagraphBlock(normalized)];
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const SENTENCE_END_ABBREVIATIONS = new Set([
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'prof.',
  'sr.',
  'jr.',
  'st.',
  'mt.',
  'vs.',
  'etc.',
  'e.g.',
  'i.e.',
  'u.s.',
  'u.k.',
]);

function shouldMergeSentenceBoundary(current: string, next: string) {
  const tail = current.trim().toLowerCase();
  if (!tail || !next.trim()) {
    return false;
  }

  const lastToken = tail.split(/\s+/).pop() ?? '';
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
    text.match(/[^.!?]+(?:[.!?]+["'”’)\]]*)?|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ??
    [];

  if (rawSentences.length <= 1) {
    return rawSentences;
  }

  const merged: string[] = [];

  for (const sentence of rawSentences) {
    const previous = merged[merged.length - 1];
    if (previous && shouldMergeSentenceBoundary(previous, sentence)) {
      merged[merged.length - 1] = `${previous} ${sentence}`.replace(/\s+/g, ' ').trim();
      continue;
    }

    merged.push(sentence);
  }

  return merged;
}

function splitParagraphIntoSegments(paragraph: string, targetWords: number, minWords: number) {
  const paragraphWords = countWords(paragraph);
  if (paragraphWords <= targetWords) {
    return [paragraph];
  }

  const sentences = splitIntoSentences(paragraph);
  if (sentences.length <= 1) {
    return [paragraph];
  }

  const segments: string[] = [];
  let currentSentences: string[] = [];
  let currentWords = 0;

  function flushSegment() {
    const segment = currentSentences.join(' ').trim();
    if (!segment) return;
    segments.push(segment);
    currentSentences = [];
    currentWords = 0;
  }

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);

    if (sentenceWords > targetWords) {
      if (currentSentences.length > 0) {
        flushSegment();
      }
      segments.push(sentence);
      continue;
    }

    if (currentWords >= minWords && currentWords + sentenceWords > targetWords) {
      flushSegment();
    }

    currentSentences.push(sentence);
    currentWords += sentenceWords;
  }

  if (currentSentences.length > 0) {
    flushSegment();
  }

  if (segments.length > 1) {
    const lastSegment = segments[segments.length - 1];
    const previousSegment = segments[segments.length - 2];

    if (
      countWords(lastSegment) < Math.max(60, Math.floor(minWords * 0.4)) &&
      countWords(previousSegment) + countWords(lastSegment) <= targetWords + Math.floor(minWords * 0.35)
    ) {
      segments[segments.length - 2] = `${previousSegment} ${lastSegment}`.trim();
      segments.pop();
    }
  }

  return segments;
}

export function chunkCleanChapterText(params: {
  chapterIndex: number;
  chapterTitle: string | null;
  cleanText: string;
  targetWords?: number;
  minWords?: number;
}) {
  const targetWords = params.targetWords ?? 420;
  const minWords = params.minWords ?? 220;

  const paragraphs = splitIntoParagraphs(params.cleanText);
  const segments = paragraphs.flatMap((paragraph) =>
    splitParagraphIntoSegments(paragraph, targetWords, minWords),
  );

  const chunks: ChunkedChapterPassage[] = [];
  let currentParagraphs: string[] = [];
  let currentWords = 0;
  let chunkIndexWithinChapter = 0;

  function flushChunk() {
    const passageText = currentParagraphs.join('\n\n').trim();
    const wordCount = countWords(passageText);

    if (!passageText) return;

    chunks.push({
      chapterIndex: params.chapterIndex,
      chapterTitle: params.chapterTitle,
      chunkIndexWithinChapter,
      passageText,
      wordCount,
    });

    chunkIndexWithinChapter += 1;
    currentParagraphs = [];
    currentWords = 0;
  }

  for (const paragraph of segments) {
    const paragraphWords = countWords(paragraph);

    if (
      currentWords >= minWords &&
      currentWords + paragraphWords > targetWords
    ) {
      flushChunk();
    }

    currentParagraphs.push(paragraph);
    currentWords += paragraphWords;
  }

  if (currentParagraphs.length > 0) {
    flushChunk();
  }

  if (chunks.length > 1) {
    const lastChunk = chunks[chunks.length - 1];
    const previousChunk = chunks[chunks.length - 2];
    const smallTailThreshold = Math.max(120, Math.floor(minWords * 0.65));
    const maxMergedWords = targetWords + Math.floor(minWords * 0.9);
    const mergedWordCount = previousChunk.wordCount + lastChunk.wordCount;

    if (
      (lastChunk.wordCount < smallTailThreshold || lastChunk.wordCount < minWords) &&
      mergedWordCount <= maxMergedWords
    ) {
      previousChunk.passageText = `${previousChunk.passageText}\n\n${lastChunk.passageText}`.trim();
      previousChunk.wordCount = countWords(previousChunk.passageText);
      chunks.pop();
    }
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkIndexWithinChapter: index,
  }));
}
