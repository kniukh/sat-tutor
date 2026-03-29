export type ChunkedChapterPassage = {
  chapterIndex: number;
  chapterTitle: string | null;
  chunkIndexWithinChapter: number;
  passageText: string;
  wordCount: number;
};

function splitIntoParagraphs(text: string) {
  return text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
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

  for (const paragraph of paragraphs) {
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

  return chunks;
}
