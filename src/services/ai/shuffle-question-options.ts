type OptionKey = 'A' | 'B' | 'C' | 'D';

type QuestionWithOptions = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: OptionKey;
};

const TARGET_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

function buildSeed(question: QuestionWithOptions) {
  return [
    question.question_text,
    question.option_a,
    question.option_b,
    question.option_c,
    question.option_d,
  ].join('|');
}

function stableShuffle<T>(values: T[], seed: string) {
  const items = [...values];
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  for (let index = items.length - 1; index > 0; index -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const swapIndex = hash % (index + 1);
    const next = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = next;
  }

  return items;
}

function remapExplanation(
  explanation: string | undefined,
  keyMap: Map<OptionKey, OptionKey>,
  originalCorrectKey: OptionKey
) {
  if (!explanation) return explanation;

  const placeholders = new Map<OptionKey, string>(
    TARGET_KEYS.map((key) => [key, `__OPTION_KEY_${key}__`])
  );

  // Generated explanations commonly use both "option B" and compact forms such
  // as "B and C distort the claim". Replace every standalone uppercase option
  // key through placeholders so chained remaps cannot overwrite one another.
  let next = explanation.replace(/\b[A-D]\b/g, (key) => {
    return placeholders.get(key as OptionKey) ?? key;
  });

  for (const originalKey of TARGET_KEYS) {
    const placeholder = placeholders.get(originalKey);
    const remappedKey = keyMap.get(originalKey);
    if (placeholder && remappedKey) {
      next = next.replaceAll(placeholder, remappedKey);
    }
  }

  return next;
}

export function shuffleQuestionOptions<T extends QuestionWithOptions & { explanation?: string }>(
  question: T,
  desiredCorrectKey?: OptionKey
): T {
  const options = [
    { originalKey: 'A' as const, text: question.option_a },
    { originalKey: 'B' as const, text: question.option_b },
    { originalKey: 'C' as const, text: question.option_c },
    { originalKey: 'D' as const, text: question.option_d },
  ];
  const shuffled = stableShuffle(options, buildSeed(question));
  if (desiredCorrectKey) {
    const desiredIndex = TARGET_KEYS.indexOf(desiredCorrectKey);
    const correctIndex = shuffled.findIndex(
      (option) => option.originalKey === question.correct_option
    );
    if (correctIndex !== -1 && correctIndex !== desiredIndex) {
      [shuffled[correctIndex], shuffled[desiredIndex]] = [
        shuffled[desiredIndex],
        shuffled[correctIndex],
      ];
    }
  }

  const remapped = shuffled.map((option, index) => ({
    key: TARGET_KEYS[index],
    text: option.text,
    isCorrect: option.originalKey === question.correct_option,
  }));

  const keyMap = new Map(
    remapped.map((option, index) => [shuffled[index].originalKey, option.key])
  );

  return {
    ...question,
    option_a: remapped[0]?.text ?? question.option_a,
    option_b: remapped[1]?.text ?? question.option_b,
    option_c: remapped[2]?.text ?? question.option_c,
    option_d: remapped[3]?.text ?? question.option_d,
    correct_option: remapped.find((option) => option.isCorrect)?.key ?? question.correct_option,
    explanation: remapExplanation(
      question.explanation,
      keyMap,
      question.correct_option
    ),
  };
}
