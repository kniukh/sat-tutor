type MascotMood = "correct" | "incorrect" | "celebrate";
type MascotSize = "sm" | "md";

const sizeClasses: Record<MascotSize, string> = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
};

const moodClasses: Record<MascotMood, string> = {
  correct: "mascot-cat--correct",
  incorrect: "mascot-cat--incorrect",
  celebrate: "mascot-cat--celebrate",
};

export default function MascotCat({
  mood,
  size = "md",
  className = "",
}: {
  mood: MascotMood;
  size?: MascotSize;
  className?: string;
}) {
  const earFill = mood === "incorrect" ? "#fecdd3" : mood === "celebrate" ? "#bfdbfe" : "#bbf7d0";
  const faceFill =
    mood === "incorrect" ? "#fff1f2" : mood === "celebrate" ? "#eff6ff" : "#f0fdf4";
  const stroke = mood === "incorrect" ? "#be123c" : mood === "celebrate" ? "#0f766e" : "#15803d";
  const cheek = mood === "incorrect" ? "#fda4af" : mood === "celebrate" ? "#93c5fd" : "#fdba74";

  return (
    <div
      className={`mascot-cat ${moodClasses[mood]} ${sizeClasses[size]} ${className}`.trim()}
      role="img"
      aria-label={
        mood === "correct"
          ? "Happy cat mascot"
          : mood === "incorrect"
            ? "Encouraging cat mascot"
            : "Celebrating cat mascot"
      }
    >
      <svg viewBox="0 0 96 96" className="h-full w-full overflow-visible" fill="none">
        <path d="M24 34 30 15l13 14" fill={earFill} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M72 34 66 15 53 29" fill={earFill} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
        <circle cx="48" cy="49" r="27" fill={faceFill} stroke={stroke} strokeWidth="3.5" />
        <circle cx="37" cy="53" r="3.4" fill={stroke} />
        <circle cx="59" cy="53" r="3.4" fill={stroke} />
        <path d="M48 56.5 45.5 60h5L48 56.5Z" fill={stroke} />
        {mood === "incorrect" ? (
          <path
            d="M40 69c2.5-3 13.5-3 16 0"
            stroke={stroke}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : mood === "celebrate" ? (
          <path
            d="M39 64.5c4.2 5.2 13.8 5.2 18 0"
            stroke={stroke}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M40 65.5c3.5 4 12.5 4 16 0"
            stroke={stroke}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}
        <circle cx="28.5" cy="61" r="3.5" fill={cheek} opacity="0.7" />
        <circle cx="67.5" cy="61" r="3.5" fill={cheek} opacity="0.7" />
        <path d="M24 58H12" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M24 63H13" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        <path d="M72 58h12" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M72 63h11" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        {mood === "celebrate" ? (
          <g className="mascot-cat__spark">
            <path
              d="m76 24 2.8 6.3L85 33l-6.2 2.7L76 42l-2.8-6.3L67 33l6.2-2.7L76 24Z"
              fill="#f59e0b"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
