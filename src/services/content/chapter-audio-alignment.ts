export type ChapterSentenceAlignment = {
  sentenceIndex: number;
  sentenceText: string;
  charStart: number;
  charEnd: number;
  audioStartMs: number | null;
  audioEndMs: number | null;
  confidence: number;
  alignmentMethod: string;
};

export type ChunkAudioWindow = {
  audioUrl: string | null;
  audioStartMs: number | null;
  audioEndMs: number | null;
  sentenceStartIndex: number | null;
  sentenceEndIndex: number | null;
  sentenceTimings: ChunkSentenceAudioTiming[];
  confidence: number | null;
  alignmentMethod: string | null;
};

export type ChunkSentenceAudioTiming = {
  sentenceIndex: number;
  sentenceText: string;
  audioStartMs: number | null;
  audioEndMs: number | null;
  confidence: number;
};

export type TranscriptWordTimestamp = {
  word: string;
  start: number;
  end: number;
};

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

function normalizeInlineWhitespace(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeForMatch(text: string) {
  return normalizeInlineWhitespace(text)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'"!?.,;:-]+/g, " ")
    .trim();
}

function normalizeToken(text: string) {
  return text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .trim();
}

function tokenizeForAlignment(text: string) {
  return normalizeInlineWhitespace(text)
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function countWords(text: string) {
  return normalizeInlineWhitespace(text).split(/\s+/).filter(Boolean).length;
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

  return /^[a-z]\.$/i.test(lastToken);
}

function tokensMatch(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  if (left.length >= 5 && right.length >= 5) {
    return left.startsWith(right) || right.startsWith(left);
  }

  return false;
}

export function splitChapterTextIntoSentences(text: string) {
  const normalizedText = text.replace(/\r/g, "").replace(/\u00a0/g, " ");
  const rawMatches = Array.from(
    normalizedText.matchAll(/[^.!?]+(?:[.!?]+["'”’)\]]*)?|[^.!?]+$/g)
  )
    .map((match) => ({
      text: match[0].trim(),
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }))
    .filter((match) => Boolean(match.text));

  const merged: Array<{ text: string; start: number; end: number }> = [];

  for (const sentence of rawMatches) {
    const previous = merged[merged.length - 1];
    if (previous && shouldMergeSentenceBoundary(previous.text, sentence.text)) {
      previous.text = normalizeInlineWhitespace(`${previous.text} ${sentence.text}`);
      previous.end = sentence.end;
      continue;
    }

    merged.push({
      text: normalizeInlineWhitespace(sentence.text),
      start: sentence.start,
      end: sentence.end,
    });
  }

  return merged.map((sentence, index) => ({
    sentenceIndex: index,
    sentenceText: sentence.text,
    charStart: sentence.start,
    charEnd: sentence.end,
  }));
}

function scoreCandidateStart(params: {
  sentenceTokens: string[];
  transcriptTokens: string[];
  startIndex: number;
}) {
  const probeTokens = params.sentenceTokens.slice(0, Math.min(12, params.sentenceTokens.length));
  const transcriptProbe = params.transcriptTokens.slice(
    params.startIndex,
    params.startIndex + probeTokens.length + 6
  );
  let transcriptIndex = 0;
  let matched = 0;

  for (const token of probeTokens) {
    let found = false;
    const maxScan = Math.min(transcriptProbe.length, transcriptIndex + 4);

    for (let index = transcriptIndex; index < maxScan; index += 1) {
      if (tokensMatch(token, transcriptProbe[index])) {
        transcriptIndex = index + 1;
        matched += 1;
        found = true;
        break;
      }
    }

    if (!found && matched === 0 && transcriptIndex > 4) {
      break;
    }
  }

  return probeTokens.length > 0 ? matched / probeTokens.length : 0;
}

function alignSentenceTokensToTranscript(params: {
  sentenceTokens: string[];
  transcriptTokens: string[];
  transcriptWords: TranscriptWordTimestamp[];
  searchStart: number;
  searchEnd: number;
}) {
  if (params.sentenceTokens.length === 0 || params.transcriptTokens.length === 0) {
    return null;
  }

  let bestStart = -1;
  let bestStartScore = 0;
  const start = Math.max(0, params.searchStart);
  const end = Math.min(params.transcriptTokens.length - 1, params.searchEnd);

  for (let candidateStart = start; candidateStart <= end; candidateStart += 1) {
    const score = scoreCandidateStart({
      sentenceTokens: params.sentenceTokens,
      transcriptTokens: params.transcriptTokens,
      startIndex: candidateStart,
    });

    if (score > bestStartScore) {
      bestStartScore = score;
      bestStart = candidateStart;
    }
  }

  if (bestStart < 0 || bestStartScore < 0.28) {
    return null;
  }

  let transcriptIndex = bestStart;
  let firstMatchedIndex: number | null = null;
  let lastMatchedIndex: number | null = null;
  let matched = 0;
  const maxTranscriptIndex = Math.min(
    params.transcriptTokens.length,
    bestStart + Math.max(16, Math.ceil(params.sentenceTokens.length * 1.8) + 10)
  );

  for (const sentenceToken of params.sentenceTokens) {
    let foundIndex = -1;
    const scanEnd = Math.min(maxTranscriptIndex, transcriptIndex + 5);

    for (let index = transcriptIndex; index < scanEnd; index += 1) {
      if (tokensMatch(sentenceToken, params.transcriptTokens[index])) {
        foundIndex = index;
        break;
      }
    }

    if (foundIndex >= 0) {
      firstMatchedIndex = firstMatchedIndex ?? foundIndex;
      lastMatchedIndex = foundIndex;
      transcriptIndex = foundIndex + 1;
      matched += 1;
      continue;
    }

    transcriptIndex = Math.min(transcriptIndex + 1, maxTranscriptIndex);
  }

  if (firstMatchedIndex === null || lastMatchedIndex === null) {
    return null;
  }

  const confidence = matched / Math.max(1, params.sentenceTokens.length);
  if (confidence < 0.42) {
    return null;
  }

  return {
    startWordIndex: firstMatchedIndex,
    endWordIndex: lastMatchedIndex,
    nextSearchStart: Math.max(lastMatchedIndex + 1, bestStart + 1),
    confidence: Number(Math.min(0.98, Math.max(confidence, bestStartScore)).toFixed(2)),
  };
}

export function buildEstimatedSentenceAlignments(params: {
  chapterText: string;
  audioDurationMs: number | null;
}): ChapterSentenceAlignment[] {
  const sentences = splitChapterTextIntoSentences(params.chapterText);
  const totalWords = sentences.reduce(
    (sum, sentence) => sum + Math.max(1, countWords(sentence.sentenceText)),
    0
  );
  const durationMs = Math.max(0, Math.floor(params.audioDurationMs ?? 0));
  let cursorMs = 0;

  return sentences.map((sentence, index) => {
    const sentenceWords = Math.max(1, countWords(sentence.sentenceText));
    const isLast = index === sentences.length - 1;
    const estimatedDuration =
      durationMs > 0 ? Math.round((sentenceWords / Math.max(1, totalWords)) * durationMs) : 0;
    const audioStartMs = durationMs > 0 ? cursorMs : null;
    const audioEndMs = durationMs > 0 ? (isLast ? durationMs : cursorMs + estimatedDuration) : null;
    cursorMs = audioEndMs ?? cursorMs;

    return {
      ...sentence,
      audioStartMs,
      audioEndMs,
      confidence: durationMs > 0 ? 0.55 : 0.2,
      alignmentMethod: durationMs > 0 ? "estimated_by_word_count" : "sentence_only",
    };
  });
}

export function buildSttSentenceAlignments(params: {
  chapterText: string;
  transcriptWords: TranscriptWordTimestamp[];
  fallbackDurationMs: number | null;
}) {
  const estimatedAlignments = buildEstimatedSentenceAlignments({
    chapterText: params.chapterText,
    audioDurationMs: params.fallbackDurationMs,
  });
  const transcriptWords = params.transcriptWords.filter(
    (word) => word.word.trim() && Number.isFinite(word.start) && Number.isFinite(word.end)
  );
  const transcriptTokens = transcriptWords.map((word) => normalizeToken(word.word));
  let searchCursor = 0;

  if (transcriptTokens.length === 0) {
    return estimatedAlignments;
  }

  return estimatedAlignments.map((sentence, index) => {
    const sentenceTokens = tokenizeForAlignment(sentence.sentenceText);
    const searchStart = index <= 1 ? 0 : Math.max(0, searchCursor - 12);
    const searchEnd =
      index <= 1
        ? Math.min(transcriptTokens.length - 1, Math.max(600, sentenceTokens.length * 8))
        : Math.min(
            transcriptTokens.length - 1,
            searchCursor + Math.max(220, sentenceTokens.length * 8)
          );
    const match = alignSentenceTokensToTranscript({
      sentenceTokens,
      transcriptTokens,
      transcriptWords,
      searchStart,
      searchEnd,
    });

    if (!match) {
      return {
        ...sentence,
        confidence: Math.min(sentence.confidence, 0.35),
        alignmentMethod: `${sentence.alignmentMethod}_fallback_after_stt`,
      };
    }

    searchCursor = match.nextSearchStart;
    const startWord = transcriptWords[match.startWordIndex];
    const endWord = transcriptWords[match.endWordIndex];

    return {
      ...sentence,
      audioStartMs: Math.max(0, Math.round(startWord.start * 1000)),
      audioEndMs: Math.max(0, Math.round(endWord.end * 1000)),
      confidence: match.confidence,
      alignmentMethod: "stt_word_timestamps",
    };
  });
}

function findSentenceWindowInChapter(params: {
  chunkText: string;
  chapterSentences: ChapterSentenceAlignment[];
}) {
  const chunkSentences = splitChapterTextIntoSentences(params.chunkText);
  if (chunkSentences.length === 0 || params.chapterSentences.length === 0) {
    return null;
  }

  const normalizedChapterSentences = params.chapterSentences.map((sentence) =>
    normalizeForMatch(sentence.sentenceText)
  );
  const normalizedChunkSentences = chunkSentences.map((sentence) =>
    normalizeForMatch(sentence.sentenceText)
  );
  const firstChunkSentence = normalizedChunkSentences[0];

  if (!firstChunkSentence) {
    return null;
  }

  for (let startIndex = 0; startIndex < normalizedChapterSentences.length; startIndex += 1) {
    if (normalizedChapterSentences[startIndex] !== firstChunkSentence) {
      continue;
    }

    const endIndex = startIndex + normalizedChunkSentences.length - 1;
    const window = normalizedChapterSentences.slice(startIndex, endIndex + 1);
    const matches = normalizedChunkSentences.every(
      (sentence, index) => window[index] === sentence
    );

    if (matches) {
      return {
        startIndex,
        endIndex,
      };
    }
  }

  const normalizedChunkText = normalizeForMatch(params.chunkText);
  const chapterText = normalizedChapterSentences.join(" ");
  const chunkStart = chapterText.indexOf(normalizedChunkText);
  if (chunkStart < 0) {
    return null;
  }

  let cursor = 0;
  let startIndex: number | null = null;
  let endIndex: number | null = null;

  for (let index = 0; index < normalizedChapterSentences.length; index += 1) {
    const sentence = normalizedChapterSentences[index];
    const sentenceStart = cursor;
    const sentenceEnd = cursor + sentence.length;
    cursor = sentenceEnd + 1;

    if (startIndex === null && sentenceEnd >= chunkStart) {
      startIndex = index;
    }

    if (startIndex !== null && sentenceStart <= chunkStart + normalizedChunkText.length) {
      endIndex = index;
    }
  }

  return startIndex !== null && endIndex !== null ? { startIndex, endIndex } : null;
}

export function resolveChunkAudioWindow(params: {
  audioUrl: string | null | undefined;
  chunkText: string;
  chapterSentences: ChapterSentenceAlignment[];
}): ChunkAudioWindow {
  const audioUrl = params.audioUrl?.trim() || null;
  if (!audioUrl) {
    return {
      audioUrl: null,
      audioStartMs: null,
      audioEndMs: null,
      sentenceStartIndex: null,
      sentenceEndIndex: null,
      sentenceTimings: [],
      confidence: null,
      alignmentMethod: null,
    };
  }

  const sentenceWindow = findSentenceWindowInChapter({
    chunkText: params.chunkText,
    chapterSentences: params.chapterSentences,
  });

  if (!sentenceWindow) {
    return {
      audioUrl,
      audioStartMs: null,
      audioEndMs: null,
      sentenceStartIndex: null,
      sentenceEndIndex: null,
      sentenceTimings: [],
      confidence: 0,
      alignmentMethod: "unmatched_chunk_text",
    };
  }

  const startSentence = params.chapterSentences[sentenceWindow.startIndex];
  const endSentence = params.chapterSentences[sentenceWindow.endIndex];
  const confidences = params.chapterSentences
    .slice(sentenceWindow.startIndex, sentenceWindow.endIndex + 1)
    .map((sentence) => sentence.confidence);
  const sentenceTimings = params.chapterSentences
    .slice(sentenceWindow.startIndex, sentenceWindow.endIndex + 1)
    .map((sentence, localIndex) => ({
      sentenceIndex: localIndex,
      sentenceText: sentence.sentenceText,
      audioStartMs: sentence.audioStartMs,
      audioEndMs: sentence.audioEndMs,
      confidence: sentence.confidence,
    }));

  return {
    audioUrl,
    audioStartMs: startSentence?.audioStartMs ?? null,
    audioEndMs: endSentence?.audioEndMs ?? null,
    sentenceStartIndex: sentenceWindow.startIndex,
    sentenceEndIndex: sentenceWindow.endIndex,
    sentenceTimings,
    confidence:
      confidences.length > 0
        ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2))
        : null,
    alignmentMethod: startSentence?.alignmentMethod ?? null,
  };
}
