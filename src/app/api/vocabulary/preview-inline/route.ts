import { NextResponse } from 'next/server';
import { isStudentApiAuthError, requireStudentApiStudentId } from "@/lib/auth/student-api";
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateInlineVocabularyPreview } from "@/services/ai/generate-inline-vocabulary-preview";
import {
  buildVocabularyDictionaryCacheKey,
  listVocabularyDictionaryCacheEntries,
  touchVocabularyDictionaryCacheEntries,
  upsertVocabularyDictionaryCacheEntries,
} from "@/services/vocabulary/vocabulary-dictionary-cache.service";
import { hasPlaceholderVocabularyContent } from "@/services/vocabulary/vocabulary-placeholder-content";

function getItemType(text: string): 'word' | 'phrase' {
  return text.trim().includes(' ') ? 'phrase' : 'word';
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    studentId,
    lessonId,
    passageId,
    itemText,
    sourceText,
  }: {
    studentId: string;
    lessonId: string;
    passageId?: string;
    itemText: string;
    sourceText?: string;
  } = body;

  if (!lessonId || !itemText?.trim() || (!passageId && !sourceText?.trim())) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  let sessionStudentId: string;

  try {
    sessionStudentId = await requireStudentApiStudentId(studentId);
  } catch (error) {
    if (isStudentApiAuthError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', sessionStudentId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  let referenceText = sourceText?.trim() || "";

  if (!referenceText && passageId) {
    const { data: passage, error: passageError } = await supabase
      .from('lesson_passages')
      .select('*')
      .eq('id', passageId)
      .single();

    if (passageError || !passage) {
      return NextResponse.json({ error: 'Passage not found' }, { status: 404 });
    }

    referenceText = passage.passage_text ?? "";
  }

  if (!referenceText) {
    return NextResponse.json({ error: 'Reference text not found' }, { status: 404 });
  }

  try {
    const itemType = getItemType(itemText);
    const normalizedItemText = itemText.trim();
    const nativeLanguage = student.native_language ?? "ru";

    const dictionaryCache = await listVocabularyDictionaryCacheEntries({
      items: [{ itemText: normalizedItemText, itemType }],
      translationLanguage: nativeLanguage,
    });
    const cacheKey = buildVocabularyDictionaryCacheKey({
      itemText: normalizedItemText,
      itemType,
      translationLanguage: nativeLanguage,
    });
    const cachedEntry = dictionaryCache.get(cacheKey) ?? null;

    if (cachedEntry) {
      void touchVocabularyDictionaryCacheEntries([cachedEntry]).catch((error) => {
        console.error("inline vocabulary cache touch failed", error);
      });

      return NextResponse.json({
        data: {
          item_text: cachedEntry.itemText,
          item_type: cachedEntry.itemType,
          plain_english_meaning: cachedEntry.englishExplanation,
          translation: cachedEntry.translatedExplanation,
          context_meaning: cachedEntry.englishExplanation,
        },
        source: "dictionary_cache",
      });
    }

    const preview = await generateInlineVocabularyPreview({
      nativeLanguage,
      passageText: referenceText,
      itemText: normalizedItemText,
      itemType,
      studentId: sessionStudentId,
    });

    const shouldCacheGeneratedCard =
      preview &&
      !hasPlaceholderVocabularyContent({
        itemText: preview.item_text,
        englishExplanation: preview.plain_english_meaning,
        translatedExplanation: preview.translation,
      });

    if (shouldCacheGeneratedCard) {
      void upsertVocabularyDictionaryCacheEntries([
        {
          itemText: preview.item_text,
          itemType,
          translationLanguage: nativeLanguage,
          englishExplanation: preview.plain_english_meaning,
          translatedExplanation: preview.translation,
          exampleText: preview.context_meaning,
          sourceQuality: "ai_generated",
        },
      ]).catch((error) => {
        console.error("inline vocabulary cache write failed", error);
      });
    }

    return NextResponse.json({ data: preview, source: "inline_preview" });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Preview generation failed",
      },
      { status: 500 },
    );
  }
}
