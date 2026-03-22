import { openai } from '@/lib/openai';

type DetectedChapter = {
  chapter_index: number;
  chapter_title: string;
  start_page: number;
  end_page: number | null;
};

type ExcludedSection = {
  label: string;
  start_page: number;
  end_page: number | null;
};

type BookStructureResult = {
  front_matter_end_page: number | null;
  body_start_page: number | null;
  body_end_page: number | null;
  detected_chapters_json: DetectedChapter[];
  excluded_sections_json: ExcludedSection[];
  cleaning_notes: string;
};

function extractJsonObject(text: string): BookStructureResult {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON object');
  }

  return JSON.parse(text.slice(start, end + 1));
}

export async function detectBookStructure(input: {
  title?: string | null;
  author?: string | null;
  pages: Array<{
    page_number: number;
    raw_text: string;
  }>;
}) {
  const pagePreview = input.pages
    .slice(0, 80)
    .map(
      (page) =>
        `PAGE ${page.page_number}\n${(page.raw_text || '').slice(0, 2200)}`,
    )
    .join('\n\n---\n\n');

  const prompt = `
You are analyzing a book PDF extraction.

Goal:
Find where the real book body starts and ends, which sections should be excluded,
and detect chapter boundaries.

Rules:
- Exclude front matter such as title page, copyright, table of contents, preface, foreword, introduction, acknowledgements.
- Exclude notes/endnotes/appendix/glossary if they are clearly outside the main book body.
- Detect the start of the main reading text as accurately as possible.
- Detect chapter titles if visible.
- Return ONLY valid JSON object.

Book title:
${input.title ?? 'Unknown'}

Author:
${input.author ?? 'Unknown'}

Pages:
${pagePreview}

JSON shape:
{
  "front_matter_end_page": 6,
  "body_start_page": 7,
  "body_end_page": 240,
  "detected_chapters_json": [
    {
      "chapter_index": 1,
      "chapter_title": "Chapter 1",
      "start_page": 7,
      "end_page": 18
    }
  ],
  "excluded_sections_json": [
    {
      "label": "Preface",
      "start_page": 3,
      "end_page": 5
    }
  ],
  "cleaning_notes": "string"
}
`;

  const response = await openai.responses.create({
    model: 'gpt-5',
    input: prompt,
  });

  return extractJsonObject(response.output_text);
}