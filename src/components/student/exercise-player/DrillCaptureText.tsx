"use client";

import { useMemo, useRef, type MouseEvent } from "react";
import type { SupportedVocabExerciseType } from "@/types/vocab-exercises";

type Props = {
  text: string;
  studentId?: string;
  lessonId?: string | null;
  drillType: SupportedVocabExerciseType;
  contextText?: string | null;
  isDistractor?: boolean;
  className?: string;
  highlightText?: string | null;
  as?: "span" | "div";
  onCaptured?: (itemText: string) => void;
};

function normalizeWord(word: string) {
  return word
    .toLowerCase()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")
    .trim();
}

function tokenize(text: string) {
  return text.split(/(\s+)/g);
}

export default function DrillCaptureText({
  text,
  studentId,
  lessonId,
  drillType,
  contextText,
  isDistractor = false,
  className,
  highlightText,
  as = "span",
  onCaptured,
}: Props) {
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickUntilRef = useRef<number>(0);
  const highlightTokens = useMemo(
    () =>
      new Set(
        tokenize(highlightText ?? "")
          .map((token) => normalizeWord(token))
          .filter(Boolean)
      ),
    [highlightText]
  );

  function clearLongPress() {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  async function captureToken(rawToken: string) {
    const itemText = normalizeWord(rawToken);
    if (!studentId || !itemText) {
      return;
    }

    suppressClickUntilRef.current = Date.now() + 700;

    try {
      await fetch("/api/vocabulary/capture-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonId: lessonId ?? null,
          itemText,
          itemType: "word",
          sourceType: "vocab_drill",
          contextText: contextText ?? text,
          metadata: {
            source: "vocab_drill",
            drill_type: drillType,
            is_distractor: isDistractor,
            context: contextText ?? text,
          },
        }),
      });

      onCaptured?.(itemText);
    } catch (error) {
      console.error("drill capture error", error);
    }
  }

  function startLongPress(rawToken: string) {
    if (!studentId) {
      return;
    }

    clearLongPress();
    longPressTimeoutRef.current = setTimeout(() => {
      void captureToken(rawToken);
    }, 420);
  }

  function suppressOptionClick(event: MouseEvent) {
    if (Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  const Wrapper = as;

  return (
    <Wrapper className={className}>
      {tokenize(text).map((token, index) => {
        const normalized = normalizeWord(token);
        const isHighlight = normalized ? highlightTokens.has(normalized) : false;

        if (!normalized) {
          return <span key={`${token}-${index}`}>{token}</span>;
        }

        return (
          <span
            key={`${token}-${index}`}
            onTouchStart={() => startLongPress(token)}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
            onTouchCancel={clearLongPress}
            onClickCapture={suppressOptionClick}
            className={isHighlight ? "rounded-md bg-amber-200/80 px-1.5 py-0.5 font-semibold text-slate-950" : undefined}
          >
            {token}
          </span>
        );
      })}
    </Wrapper>
  );
}
