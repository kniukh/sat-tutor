'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

export default function LessonSplitLayout({
  top,
  bottom,
}: {
  top: ReactNode;
  bottom: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [topHeightPercent, setTopHeightPercent] = useState(62);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const percent = (offsetY / rect.height) * 100;

      const clamped = Math.max(30, Math.min(80, percent));
      setTopHeightPercent(clamped);
    }

    function onMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-120px)] flex-col"
    >
      <section
        className="min-h-0 overflow-y-auto rounded-2xl border bg-white p-6"
        style={{ height: `${topHeightPercent}%` }}
      >
        {top}
      </section>

      <div
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={() => setIsDragging(true)}
        className="group flex h-4 shrink-0 cursor-row-resize items-center justify-center"
      >
        <div className="h-1 w-20 rounded-full bg-slate-300 transition group-hover:bg-slate-400" />
      </div>

      <section
        className="min-h-0 overflow-y-auto rounded-2xl border bg-white p-6"
        style={{ height: `${100 - topHeightPercent}%` }}
      >
        {bottom}
      </section>
    </div>
  );
}