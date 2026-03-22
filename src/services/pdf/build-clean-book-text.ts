type ChapterLike = {
  chapter_index: number;
  chapter_title: string;
  start_page: number;
  end_page: number | null;
};

type PageLike = {
  page_number: number;
  raw_text: string;
};

function normalizePageText(text: string) {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildCleanBookText(params: {
  pages: PageLike[];
  bodyStartPage: number | null;
  bodyEndPage: number | null;
  chapters: ChapterLike[];
}) {
  const pages = params.pages
    .filter((p) => {
      if (params.bodyStartPage && p.page_number < params.bodyStartPage) return false;
      if (params.bodyEndPage && p.page_number > params.bodyEndPage) return false;
      return true;
    })
    .map((p) => ({
      ...p,
      raw_text: normalizePageText(p.raw_text),
    }));

  const chapters = [...params.chapters].sort((a, b) => a.chapter_index - b.chapter_index);

  if (chapters.length === 0) {
    return [
      {
        chapter_index: 1,
        chapter_title: 'Book Body',
        clean_text: pages.map((p) => p.raw_text).join('\n\n').trim(),
      },
    ];
  }

  return chapters.map((chapter, idx) => {
    const nextChapter = chapters[idx + 1] ?? null;
    const chapterEnd =
      chapter.end_page ??
      (nextChapter ? nextChapter.start_page - 1 : params.bodyEndPage ?? null);

    const chapterPages = pages.filter((p) => {
      if (p.page_number < chapter.start_page) return false;
      if (chapterEnd && p.page_number > chapterEnd) return false;
      return true;
    });

    return {
      chapter_index: chapter.chapter_index,
      chapter_title: chapter.chapter_title || `Chapter ${chapter.chapter_index}`,
      clean_text: chapterPages.map((p) => p.raw_text).join('\n\n').trim(),
    };
  });
}