import type { ReactNode } from "react";

type Props = {
  eyebrow?: string | null;
  title?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
};

export default function ExercisePromptPanel({ eyebrow, title, body, footer }: Props) {
  void eyebrow;

  return (
    <div className="space-y-4 px-1">
        {title ? (
          <div className="text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
            {title}
          </div>
        ) : null}

        {body ? <div className="text-slate-800">{body}</div> : null}

        {footer ? <div className="text-sm leading-6 text-slate-500">{footer}</div> : null}
    </div>
  );
}
