export type LessonType =
  | 'reading_vocab'
  | 'vocab_drill'
  | 'real_test'
  | 'math_drill'
  | 'quiz';

export type LessonStatus = 'draft' | 'review' | 'published' | 'archived';

export type QuestionOption = 'A' | 'B' | 'C' | 'D';

export interface LessonQuestion {
  id: string;
  lesson_id: string;
  question_type: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: QuestionOption;
  explanation?: string | null;
  difficulty: number;
  meta_json: Record<string, unknown>;
  display_order: number;
}

export interface LessonPassage {
  id: string;
  lesson_id: string;
  title?: string | null;
  passage_text: string;
  passage_kind: 'prose' | 'poem' | 'article';
  author?: string | null;
  source?: string | null;
  word_count?: number | null;
  is_primary: boolean;
  display_order: number;
}