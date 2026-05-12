function normalizeComparableText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function normalizeItemKey(itemText: string) {
  return normalizeComparableText(itemText);
}

export function isPlaceholderVocabularyDefinition(params: {
  itemText: string;
  englishExplanation: string | null | undefined;
}) {
  const english = normalizeComparableText(params.englishExplanation);
  const itemKey = normalizeItemKey(params.itemText);

  if (!english) {
    return true;
  }

  return (
    english === "quick preview not ready yet." ||
    english === "meaning of this word in the passage." ||
    english === "meaning of this phrase in the passage." ||
    english === `meaning of "${itemKey}"` ||
    english === `meaning of "${itemKey}" in the passage.` ||
    english === `meaning of "${itemKey}" in this lesson.`
  );
}

export function isPlaceholderVocabularyTranslation(params: {
  itemText: string;
  translatedExplanation: string | null | undefined;
}) {
  const translation = normalizeComparableText(params.translatedExplanation);
  const itemKey = normalizeItemKey(params.itemText);

  if (!translation) {
    return true;
  }

  return (
    translation === itemKey ||
    translation === `перевод: ${itemKey}` ||
    translation === `translation: ${itemKey}`
  );
}

export function hasPlaceholderVocabularyContent(params: {
  itemText: string;
  englishExplanation: string | null | undefined;
  translatedExplanation: string | null | undefined;
}) {
  return (
    isPlaceholderVocabularyDefinition({
      itemText: params.itemText,
      englishExplanation: params.englishExplanation,
    }) ||
    isPlaceholderVocabularyTranslation({
      itemText: params.itemText,
      translatedExplanation: params.translatedExplanation,
    })
  );
}
