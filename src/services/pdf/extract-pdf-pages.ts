import fs from 'node:fs/promises';
import { getPath } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

// Set worker before using PDFParse
PDFParse.setWorker(getPath());

export type ExtractedPdfPage = {
  pageNumber: number;
  rawText: string;
};

export async function extractPdfPages(filePath: string): Promise<ExtractedPdfPage[]> {
  console.log('Extracting PDF pages from:', filePath);
  const buffer = await fs.readFile(filePath);
  console.log('Buffer length:', buffer.length);

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    console.log('Extraction result pages count:', result.pages.length);

    return result.pages.map((page) => ({
      pageNumber: page.num,
      rawText: (page.text ?? '').replace(/\s+/g, ' ').trim(),
    }));
  } finally {
    await parser.destroy();
  }
}