export type VocabularyItemType = "word" | "phrase";

export type VocabularyNormalizationReason =
  | "exact"
  | "phrase_passthrough"
  | "possessive_trim"
  | "irregular_plural"
  | "plural_ies"
  | "plural_es"
  | "plural_s"
  | "verb_ied"
  | "verb_ing_double_consonant"
  | "verb_ed_double_consonant";

export type ResolvedVocabularyLemma = {
  itemType: VocabularyItemType;
  capturedSurfaceForm: string;
  normalizedSurfaceForm: string;
  canonicalLemma: string;
  normalizationReason: VocabularyNormalizationReason;
};

const IRREGULAR_PLURAL_LEMMAS: Record<string, string> = {
  children: "child",
  feet: "foot",
  geese: "goose",
  men: "man",
  mice: "mouse",
  teeth: "tooth",
  women: "woman",
};

const DOUBLE_CONSONANT_ENDING = /([b-df-hj-np-tv-z])\1$/i;

function trimOuterPunctuation(text: string) {
  return text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function normalizeVocabularyItemType(
  itemText: string,
  itemType: string | null | undefined
): VocabularyItemType {
  if (itemType === "phrase") {
    return "phrase";
  }

  return itemText.trim().includes(" ") ? "phrase" : "word";
}

export function normalizeCapturedSurfaceForm(itemText: string) {
  return trimOuterPunctuation(itemText.trim().replace(/\s+/g, " "));
}

export function normalizeVocabularySurfaceForm(itemText: string) {
  return normalizeCapturedSurfaceForm(itemText).toLowerCase();
}

function resolveWordLemma(normalizedSurfaceForm: string): {
  canonicalLemma: string;
  normalizationReason: VocabularyNormalizationReason;
} {
  if (!normalizedSurfaceForm) {
    return {
      canonicalLemma: normalizedSurfaceForm,
      normalizationReason: "exact",
    };
  }

  const possessive = normalizedSurfaceForm.replace(/(?:'s|’s)$/i, "");
  if (possessive && possessive !== normalizedSurfaceForm) {
    return {
      canonicalLemma: possessive,
      normalizationReason: "possessive_trim",
    };
  }

  const irregularPlural = IRREGULAR_PLURAL_LEMMAS[normalizedSurfaceForm];
  if (irregularPlural) {
    return {
      canonicalLemma: irregularPlural,
      normalizationReason: "irregular_plural",
    };
  }

  if (
    normalizedSurfaceForm.endsWith("ies") &&
    normalizedSurfaceForm.length > 4 &&
    !normalizedSurfaceForm.endsWith("eies")
  ) {
    return {
      canonicalLemma: `${normalizedSurfaceForm.slice(0, -3)}y`,
      normalizationReason: "plural_ies",
    };
  }

  if (
    /(ches|shes|sses|xes|zes|oes)$/i.test(normalizedSurfaceForm) &&
    normalizedSurfaceForm.length > 4
  ) {
    return {
      canonicalLemma: normalizedSurfaceForm.slice(0, -2),
      normalizationReason: "plural_es",
    };
  }

  if (
    normalizedSurfaceForm.endsWith("s") &&
    normalizedSurfaceForm.length > 3 &&
    !/(ss|us|is)$/i.test(normalizedSurfaceForm)
  ) {
    return {
      canonicalLemma: normalizedSurfaceForm.slice(0, -1),
      normalizationReason: "plural_s",
    };
  }

  if (normalizedSurfaceForm.endsWith("ied") && normalizedSurfaceForm.length > 4) {
    return {
      canonicalLemma: `${normalizedSurfaceForm.slice(0, -3)}y`,
      normalizationReason: "verb_ied",
    };
  }

  if (normalizedSurfaceForm.endsWith("ing") && normalizedSurfaceForm.length > 5) {
    const stem = normalizedSurfaceForm.slice(0, -3);
    if (DOUBLE_CONSONANT_ENDING.test(stem)) {
      return {
        canonicalLemma: stem.slice(0, -1),
        normalizationReason: "verb_ing_double_consonant",
      };
    }
  }

  if (normalizedSurfaceForm.endsWith("ed") && normalizedSurfaceForm.length > 4) {
    const stem = normalizedSurfaceForm.slice(0, -2);
    if (DOUBLE_CONSONANT_ENDING.test(stem)) {
      return {
        canonicalLemma: stem.slice(0, -1),
        normalizationReason: "verb_ed_double_consonant",
      };
    }
  }

  return {
    canonicalLemma: normalizedSurfaceForm,
    normalizationReason: "exact",
  };
}

export function resolveVocabularyLemma(params: {
  itemText: string;
  itemType?: string | null;
}) : ResolvedVocabularyLemma {
  const capturedSurfaceForm = normalizeCapturedSurfaceForm(params.itemText);
  const normalizedSurfaceForm = normalizeVocabularySurfaceForm(params.itemText);
  const itemType = normalizeVocabularyItemType(params.itemText, params.itemType);

  if (!normalizedSurfaceForm) {
    return {
      itemType,
      capturedSurfaceForm,
      normalizedSurfaceForm,
      canonicalLemma: normalizedSurfaceForm,
      normalizationReason: itemType === "phrase" ? "phrase_passthrough" : "exact",
    };
  }

  if (itemType === "phrase" || normalizedSurfaceForm.includes(" ")) {
    return {
      itemType,
      capturedSurfaceForm,
      normalizedSurfaceForm,
      canonicalLemma: normalizedSurfaceForm,
      normalizationReason: "phrase_passthrough",
    };
  }

  const resolved = resolveWordLemma(normalizedSurfaceForm);

  return {
    itemType,
    capturedSurfaceForm,
    normalizedSurfaceForm,
    canonicalLemma: resolved.canonicalLemma,
    normalizationReason: resolved.normalizationReason,
  };
}

export function mergeVocabularySurfaceForms(
  existingValue: unknown,
  incomingValues: Array<string | null | undefined>
) {
  const merged = new Set<string>();

  if (Array.isArray(existingValue)) {
    for (const entry of existingValue) {
      if (typeof entry !== "string") {
        continue;
      }

      const normalized = normalizeCapturedSurfaceForm(entry);
      if (normalized) {
        merged.add(normalized);
      }
    }
  }

  for (const value of incomingValues) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = normalizeCapturedSurfaceForm(value);
    if (normalized) {
      merged.add(normalized);
    }
  }

  return Array.from(merged);
}
