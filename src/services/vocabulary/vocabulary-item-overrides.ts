export type VocabularyItemOverrideFields = {
  english_explanation?: string | null;
  translated_explanation?: string | null;
  student_definition_override?: string | null;
  student_translation_override?: string | null;
  definition_override_generated_from_context?: boolean | null;
};

export function getEffectiveVocabularyDefinition(
  item: VocabularyItemOverrideFields | null | undefined
) {
  const override = item?.student_definition_override?.trim();
  if (override) {
    return override;
  }

  const fallback = item?.english_explanation?.trim();
  return fallback || null;
}

export function getEffectiveVocabularyTranslation(
  item: VocabularyItemOverrideFields | null | undefined
) {
  const override = item?.student_translation_override?.trim();
  if (override) {
    return override;
  }

  const fallback = item?.translated_explanation?.trim();
  return fallback || null;
}

export function hasContextGeneratedVocabularyOverride(
  item: VocabularyItemOverrideFields | null | undefined
) {
  return Boolean(
    item?.definition_override_generated_from_context &&
      item?.student_definition_override?.trim()
  );
}
