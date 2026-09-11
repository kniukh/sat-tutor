# DET Reading Question Types

## Initial Set

1. `main_idea`: What is the passage mainly about?
2. `factual_detail`: What detail is stated in the passage?
3. `vocabulary_in_context`: What does a word or phrase mean here?
4. `inference`: What can be reasonably concluded?
5. `sentence_completion`: Which sentence best completes the idea?

The first release uses four questions per chunk and may rotate the fifth type to avoid repetition.

## Question Contract

Every question must include:

- stable question type;
- prompt;
- four answer options where applicable;
- correct answer;
- short explanation;
- difficulty;
- source chunk id;
- supporting sentence ids;
- review status.

## Quality Rules

- Only one answer may be clearly best.
- Distractors must be plausible but contradicted, incomplete, or less precise.
- Questions must be answerable from the chunk unless explicitly marked as cross-chunk.
- Vocabulary questions must use the meaning in this context, not a rare dictionary meaning.
- The prompt or options must not reveal the answer through wording or length.
- Every generated question requires Admin review before publication.
