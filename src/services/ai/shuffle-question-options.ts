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

export function shuffleQuestionOptions<T extends QuestionWithOptions>(question: T): T {
  const options = [
    { originalKey: 'A' as const, text: question.option_a },
    { originalKey: 'B' as const, text: question.option_b },
    { originalKey: 'C' as const, text: question.option_c },
    { originalKey: 'D' as const, text: question.option_d },
  ];
  const shuffled = stableShuffle(options, buildSeed(question));

  const remapped = shuffled.map((option, index) => ({
    key: TARGET_KEYS[index],
    text: option.text,
    isCorrect: option.originalKey === question.correct_option,
  }));

  return {
    ...question,
    option_a: remapped[0]?.text ?? question.option_a,
    option_b: remapped[1]?.text ?? question.option_b,
    option_c: remapped[2]?.text ?? question.option_c,
    option_d: remapped[3]?.text ?? question.option_d,
    correct_option: remapped.find((option) => option.isCorrect)?.key ?? question.correct_option,
  };
}
