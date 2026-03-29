"use client";

import { ReactNode, useState } from "react";

type Props = {
  top: ReactNode;
  bottom: ReactNode;
};

export default function LessonSplitLayout({ top, bottom }: Props) {
  const [topHeight, setTopHeight] = useState(58);
  const [dragging, setDragging] = useState(false);

  function startDrag() {
    setDragging(true);
  }

  function stopDrag() {
    setDragging(false);
  }

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percent = (y / rect.height) * 100;

    if (percent < 25 || percent > 75) return;
    setTopHeight(percent);
  }

  return (
    <div
      className="h-[calc(100vh-120px)] w-full flex flex-col border rounded-xl overflow-hidden bg-white"
      onMouseMove={onMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div
        className="overflow-auto p-4"
        style={{ height: `${topHeight}%` }}
      >
        {top}
      </div>

      <div
        className="h-2 cursor-row-resize bg-gray-200 hover:bg-gray-300"
        onMouseDown={startDrag}
      />

      <div
        className="overflow-auto p-4 border-t bg-gray-50"
        style={{ height: `${100 - topHeight}%` }}
      >
        {bottom}
      </div>
    </div>
  );
}
