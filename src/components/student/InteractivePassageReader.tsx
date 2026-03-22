'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type VocabItem = {
  id: string;
  item_text: string;
  item_type: 'word' | 'phrase';
  english_explanation: string | null;
  translated_explanation: string | null;
  translation_language: string;
  example_text: string | null;
  audio_url?: string | null;
  audio_status?: 'pending' | 'ready' | 'failed';
};

type Segment = {
  text: string;
  vocabItem: VocabItem | null;
};

type PreviewData = {
  item_text: string;
  item_type: 'word' | 'phrase';
  plain_english_meaning: string;
  translation: string;
  context_meaning: string;
};

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWord(word: string) {
  return word
    .toLowerCase()
    .replace(/^[^a-zA-Zа-яА-ЯăîâșțĂÎÂȘȚ]+|[^a-zA-Zа-яА-ЯăîâșțĂÎÂȘȚ]+$/g, '');
}

function splitTextWithPhrases(text: string, phraseItems: VocabItem[]): Segment[] {
  if (phraseItems.length === 0) {
    return [{ text, vocabItem: null }];
  }

  const sorted = [...phraseItems].sort((a, b) => b.item_text.length - a.item_text.length);

  const matches: Array<{ start: number; end: number; vocabItem: VocabItem }> = [];

  for (const item of sorted) {
    const pattern = new RegExp(escapeRegExp(item.item_text), 'gi');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      const overlaps = matches.some(
        (existing) => !(end <= existing.start || start >= existing.end),
      );

      if (!overlaps) {
        matches.push({ start, end, vocabItem: item });
      }
    }
  }

  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    return [{ text, vocabItem: null }];
  }

  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (cursor < match.start) {
      segments.push({ text: text.slice(cursor, match.start), vocabItem: null });
    }

    segments.push({
      text: text.slice(match.start, match.end),
      vocabItem: match.vocabItem,
    });

    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), vocabItem: null });
  }

  return segments;
}

export default function InteractivePassageReader({
  title,
  text,
  vocabItems,
  studentId,
  lessonId,
  passageId,
}: {
  title?: string | null;
  text: string;
  vocabItems: VocabItem[];
  studentId: string;
  lessonId: string;
  passageId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [selectedItem, setSelectedItem] = useState<VocabItem | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);

  const { phraseItems, wordMap, existingItems } = useMemo(() => {
    const phrases = vocabItems.filter((item) => item.item_type === 'phrase');
    const words = new Map<string, VocabItem>();
    const existing = new Set<string>();

    for (const item of vocabItems) {
      existing.add(item.item_text.toLowerCase());

      if (item.item_type === 'word') {
        words.set(item.item_text.toLowerCase(), item);
      }
    }

    return {
      phraseItems: phrases,
      wordMap: words,
      existingItems: existing,
    };
  }, [vocabItems]);

  useEffect(() => {
    function handleSelection() {
      const selection = window.getSelection();
      const raw = selection?.toString().trim() ?? '';

      if (!raw || !containerRef.current || !selection || selection.rangeCount === 0) {
        setSelectionText('');
        setSelectionPosition(null);
        setPreview(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      const normalized = raw.toLowerCase().trim();

      if (existingItems.has(normalized)) {
        setSelectionText('');
        setSelectionPosition(null);
        setPreview(null);
        return;
      }

      setSelectionText(raw);
      setSelectionPosition({
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top - 40,
      });
      setPreview(null);
    }

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [existingItems]);

  async function loadPreview() {
    if (!selectionText) return;

    setPreviewLoading(true);
    setInlineMessage(null);

    const response = await fetch('/api/vocabulary/preview-inline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        lessonId,
        passageId,
        itemText: selectionText,
      }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      setInlineMessage(json?.error ?? 'Preview failed');
      setPreviewLoading(false);
      return;
    }

    setPreview(json?.data ?? null);
    setPreviewLoading(false);
  }

  async function addInlineSelection() {
    if (!selectionText) return;

    const response = await fetch('/api/vocabulary/capture-inline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        lessonId,
        passageId,
        itemText: selectionText,
        contextText: text.slice(0, 300),
      }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      setInlineMessage(json?.error ?? 'Save failed');
      return;
    }

    setInlineMessage(`Added: ${json?.itemText ?? selectionText}`);
    setSelectionText('');
    setSelectionPosition(null);
    setPreview(null);
  }

  async function playAudio(item: VocabItem) {
    if (item.item_type !== 'word') return;

    setAudioLoadingId(item.id);

    let audioUrl = item.audio_url ?? null;

    if (!audioUrl || item.audio_status !== 'ready') {
      const response = await fetch('/api/vocabulary/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyItemId: item.id }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        setInlineMessage(json?.error ?? 'Audio failed');
        setAudioLoadingId(null);
        return;
      }

      audioUrl = json?.data?.audioUrl ?? null;
    }

    if (audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      audioRef.current = new Audio(audioUrl);
      audioRef.current.play().catch(() => {});
    }

    setAudioLoadingId(null);
  }

  const paragraphs = text.split('\n').filter(Boolean);

  return (
    <div ref={containerRef} className="relative space-y-4">
      {title ? <h3 className="text-lg font-medium text-slate-900">{title}</h3> : null}

      {selectionText && selectionPosition ? (
        <div
          className="absolute z-20"
          style={{
            left: selectionPosition.x,
            top: Math.max(selectionPosition.y, 0),
          }}
        >
          <button
            type="button"
            onClick={loadPreview}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white shadow-lg"
          >
            {previewLoading ? 'Loading...' : 'Preview'}
          </button>
        </div>
      ) : null}

      {inlineMessage ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {inlineMessage}
        </div>
      ) : null}

      {preview ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-900">{preview.item_text}</div>
          <div className="mt-2 text-sm text-slate-700">
            English meaning: {preview.plain_english_meaning}
          </div>
          <div className="mt-1 text-sm text-slate-700">
            Translation: {preview.translation}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Context meaning: {preview.context_meaning}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addInlineSelection}
              className="rounded-xl bg-slate-900 px-4 py-2 text-white"
            >
              Save to vocabulary
            </button>

            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setSelectionText('');
                setSelectionPosition(null);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {paragraphs.map((paragraph, paragraphIndex) => {
          const phraseSegments = splitTextWithPhrases(paragraph, phraseItems);

          return (
            <p
              key={`${paragraphIndex}-${paragraph.slice(0, 20)}`}
              className="whitespace-pre-wrap leading-7 text-slate-700"
            >
              {phraseSegments.map((segment, segmentIndex) => {
                if (segment.vocabItem) {
                  return (
                    <button
                      key={`${paragraphIndex}-phrase-${segmentIndex}`}
                      type="button"
                      onClick={() => setSelectedItem(segment.vocabItem)}
                      className="rounded px-0.5 underline decoration-dotted underline-offset-4 hover:bg-blue-50"
                    >
                      {segment.text}
                    </button>
                  );
                }

                const parts = segment.text.split(/(\s+)/);

                return parts.map((part, partIndex) => {
                  if (/^\s+$/.test(part)) {
                    return (
                      <span key={`${paragraphIndex}-${segmentIndex}-${partIndex}`}>
                        {part}
                      </span>
                    );
                  }

                  const normalized = normalizeWord(part);
                  const vocabItem = normalized ? wordMap.get(normalized) : null;

                  if (!vocabItem) {
                    return (
                      <span key={`${paragraphIndex}-${segmentIndex}-${partIndex}`}>
                        {part}
                      </span>
                    );
                  }

                  return (
                    <button
                      key={`${paragraphIndex}-${segmentIndex}-${partIndex}`}
                      type="button"
                      onClick={() => setSelectedItem(vocabItem)}
                      className="rounded px-0.5 underline decoration-dotted underline-offset-4 hover:bg-blue-50"
                    >
                      {part}
                    </button>
                  );
                });
              })}
            </p>
          );
        })}
      </div>

      {selectedItem ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">
                {selectedItem.item_text}
              </div>
              <div className="text-sm text-slate-500">
                {selectedItem.item_type} · {selectedItem.translation_language}
              </div>
            </div>

            <div className="flex gap-2">
              {selectedItem.item_type === 'word' ? (
                <button
                  type="button"
                  onClick={() => playAudio(selectedItem)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
                >
                  {audioLoadingId === selectedItem.id ? '...' : '🔊'}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <div className="text-slate-700">
              <span className="font-medium">English meaning:</span>{' '}
              {selectedItem.english_explanation || '-'}
            </div>

            <div className="text-slate-700">
              <span className="font-medium">Translation:</span>{' '}
              {selectedItem.translated_explanation || '-'}
            </div>

            {selectedItem.example_text ? (
              <div className="text-slate-600">
                <span className="font-medium">Example:</span>{' '}
                {selectedItem.example_text}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}