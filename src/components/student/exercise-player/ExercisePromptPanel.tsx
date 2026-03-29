import type { ReactNode } from "react";

type Props = {
  eyebrow?: string | null;
  title?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
};

export default function ExercisePromptPanel({ eyebrow, title, body, footer }: Props) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 shadow-sm">
      <div className="space-y-4 p-5 sm:p-6">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </div>
        ) : null}

        {title ? (
          <div className="text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">
            {title}
          </div>
        ) : null}

        {body ? <div className="text-slate-800">{body}</div> : null}

        {footer ? <div className="border-t border-slate-200/80 pt-4 text-sm text-slate-600">{footer}</div> : null}
      </div>
    </div>
  );
}
