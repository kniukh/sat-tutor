type StudentVocabularyClientItem = {
  id: string;
  item_text: string;
  canonical_lemma?: string | null;
  english_explanation?: string | null;
  translated_explanation?: string | null;
  example_text?: string | null;
  context_sentence?: string | null;
  audio_url?: string | null;
  student_definition_override?: string | null;
  student_translation_override?: string | null;
  definition_override_generated_from_context?: boolean | null;
};

async function parseResponseOrThrow(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? fallbackMessage);
  }

  return payload;
}

export async function deleteStudentVocabularyItem(input: {
  studentId: string;
  vocabularyItemId: string;
}) {
  const response = await fetch("/api/vocabulary/delete-item", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await parseResponseOrThrow(response, "Failed to delete vocabulary item");
  return payload?.data as { id: string; itemText: string; removedAt: string };
}

export async function regenerateStudentVocabularyMeaning(input: {
  studentId: string;
  vocabularyItemId: string;
  contextText?: string | null;
}) {
  const response = await fetch("/api/vocabulary/regenerate-item-meaning", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await parseResponseOrThrow(
    response,
    "Failed to regenerate vocabulary meaning"
  );
  return payload?.data as StudentVocabularyClientItem;
}
