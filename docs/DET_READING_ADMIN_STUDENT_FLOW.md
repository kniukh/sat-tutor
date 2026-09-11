# DET Reading Admin and Student Flow

## Admin Flow

1. Create a DET book and enter metadata.
2. Upload the full text or import an approved source.
3. Run text cleanup and chapter detection.
4. Run sentence segmentation and semantic chunking.
5. Review and edit chapters, sentences, and chunks.
6. Generate questions for selected chunks.
7. Review, edit, approve, or reject questions.
8. Publish the book.
9. Optionally assign the book to one or more students.
10. Monitor processing, publication, and student progress.

## Book Statuses

`draft -> processing -> review -> published -> archived`

Only `published` books are visible to students. A published book returns to `review` if its text or questions are materially changed.

## Student Flow

1. Open the DET Reading section.
2. Browse available or assigned books.
3. Open a chapter and start the next incomplete chunk.
4. Read, optionally listen, and capture vocabulary.
5. Answer the chunk questions.
6. See feedback and continue or pause.
7. Resume later from the saved chunk.

## Student Metrics

- chunks completed;
- question accuracy;
- accuracy by question type;
- reading time;
- question response time;
- vocabulary captures;
- book and chapter progress;
- recent mistakes.

DET metrics must not alter SAT scores or SAT recommendations until an explicit cross-mode recommendation rule is added.

## Database Migrations

Apply the migrations against the linked Supabase project before using DET content:

```powershell
supabase link --project-ref <project-ref>
supabase db push --linked --yes
supabase migration list --linked
```

The DET rollout currently includes:

- `20260910120000_add_reading_content_mode.sql` - adds SAT/DET mode to sources, generated passages, and lessons.
- `20260910130000_add_det_metric_mode.sql` - stores the mode on reading metrics and question attempts.
- `20260910140000_add_reading_assignments.sql` - adds student book assignments.
- `20260911100000_add_lesson_passage_content_mode.sql` - stores the mode on lesson passages used by the player.
- `20260911110000_add_chapter_guided_learning_assignments.sql` - assigns a specific chapter and tracks guided vocabulary checkpoints.

## Publishing Checklist

1. In Admin, create the source with `DET Reading` selected.
2. Clean and segment the chapter, then review every generated chunk.
3. Edit any chunk that is too short, has an incomplete final sentence, or has an incorrect boundary.
4. Generate questions and review the question text, options, and correct answer.
5. Approve the chunks and publish the book.
6. Optionally assign the published book from the student's Admin profile.
7. Open the student DET Reading area and verify that the book appears in the assigned or available list.

For guided learning, assign a specific chapter from the student's Admin profile. The student's dashboard then presents one primary action for that chapter. It routes to Reading chunks first, inserts a Vocabulary checkpoint after every two completed chunks when chapter vocabulary exists, and shows `<Chapter> completed` after the chapter and required checkpoints are finished.

## QA Checklist

### Admin

- DET books can be created and are visibly marked as DET in the source and lesson lists.
- Source chunk editing saves updated text and recalculates the word count.
- Publishing rejects a DET chunk with fewer than 20 words or an incomplete final sentence.
- Question edits reset the question to review status and require re-approval.
- A published DET book can be assigned to an active student.
- DET analytics show assignments, lessons, WPM, accuracy, and reading minutes.

### Student

- `/s/det` opens the DET Reading area through the student's session route.
- Assigned books are available from the assigned-books view.
- A DET lesson supports reading, optional audio, sentence highlighting, vocabulary capture, and question completion.
- Progress resumes at the next incomplete chunk.
- `/s/det-progress` shows DET-only progress and does not mix SAT metrics.

### Automated checks

```powershell
npx tsc --noEmit
npm run build
```

For an authenticated smoke test, use an Admin session to publish and assign one short DET book, then complete one student chunk and confirm the saved metrics in Admin DET Insights.
