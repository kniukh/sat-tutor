# Admin and AI Content Generation QA Report

Date: 2026-07-29  
Environment: local development, `http://localhost:3000`  
Scope: admin source ingestion, passage chunking, adaptive AI lesson generation, question review, publishing guard, idempotency, authorization, and editorial quality.

## Executive summary

Original audit result: **conditional fail**.  
Post-fix regression result: **pass** (see the remediation addendum below).

The core workflow completed end to end: an article source was created, chunked, analyzed, converted into a draft lesson with four questions, reviewed, published, and returned to draft. The generated correct answers were grounded in the passage, the distractors were plausible, and the adaptive question mix suited the text.

Two release-blocking issues were found:

1. **Critical authorization gap:** some admin endpoints return data or perform processing without an authenticated admin session.
2. **High-severity explanation corruption:** three of four generated explanations refer to the wrong option letters, although the stored `correct_option` values are correct.

The test lesson and all its questions were returned to `draft` after the publish test. No student progress was changed.

## Test source and method

The test was based on David Adam's article, “Are attention spans really shrinking? What the science says”:

- Scientific American reprint: <https://www.scientificamerican.com/article/are-attention-spans-really-shrinking-what-the-science-says/>
- Original Nature News feature: <https://www.nature.com/articles/d41586-026-01407-w>

To avoid reproducing a copyrighted article in the application, the test used a limited educational adaptation. It preserved the article's central contrast between perceived distraction, observed task switching, and the lack of strong evidence for a broad decline in underlying attention capacity. The adapted passage contained 457 words in six paragraphs.

Test records:

- Source document: `5d29cff1-e397-4bfd-8d2e-c4602c388ece`
- Generated passage: `1e948a9f-876f-4737-8e51-ff2f8b54812b`
- Original lesson (removed during controlled regeneration): `25b796bb-3fda-45e4-9991-91f0fd8323af`
- Regenerated lesson: `37f3a876-e3bb-45c4-9549-8db43d720bc4`
- Final state: lesson `draft`; four questions `draft`

## Workflow results

| Check | Result | Evidence |
| --- | --- | --- |
| Admin login | Pass | HTTP 200 |
| Source creation | Pass | HTTP 200, 1.36 s |
| Clean-text chunking | Pass | HTTP 200, one 457-word passage, 2.59 s |
| Paragraph preservation | Pass | All six paragraphs remained separated |
| AI analysis and lesson generation | Pass | One lesson and four questions, 57.79 s |
| Adaptive type selection | Pass | `central_claim`, `inference`, `function`, `vocabulary_in_context` |
| Question-count contract | Pass | Three SAT questions plus one vocabulary question |
| Initial lesson state | Pass | Lesson and questions created as `draft` |
| Publish before approval | Pass | Rejected with HTTP 409 |
| Invalid review status | Pass | Rejected with HTTP 400 |
| Approve four questions | Pass | Four HTTP 200 responses |
| Publish after approval | Pass | HTTP 200 |
| Repeated generation | Pass | HTTP 200, 303 ms, `createdCount: 0`, `skippedCount: 1` |
| Cleanup after test | Pass | Lesson and questions returned to `draft` |

## Generated-content quality

### Passage analysis

The analyzer correctly classified the text as medium-difficulty analytical prose and identified:

- the distinction between attention capacity and attention behavior;
- the evidentiary limitation of cross-sectional “snapshots”;
- the function of the mind-wandering paragraph;
- suitable vocabulary targets such as `nuanced`, `snapshots`, and `fragmented`.

Its recommended mix was appropriate for this particular passage. Forcing all six supported SAT categories into one short chunk would have lowered quality. In particular, a tone question or a two-part Command of Evidence item would be less valuable here than the selected central-claim, inference, structure/purpose, and vocabulary questions.

### Question audit

| Question | Correct answer | Grounded and unique? | Distractors | Explanation |
| --- | --- | --- | --- | --- |
| Central claim | A | Yes | Good; B is incomplete, C and D contradict the passage | **Fail:** the explanation says B and C “distort” and calls D merely “too general”; this does not accurately diagnose the options |
| Inference | B | Yes | Good; each reflects a recognizable evidence error | **Fail:** after identifying B as correct, the explanation says “B overinterprets workplace data”; it should say **A** |
| Text structure/purpose (`function`) | C | Yes | Good; the paragraph clearly complicates a deficit-only account | **Fail:** it calls B a summary and then lists C as incorrect; the intended incorrect labels are **A, B, and D** |
| Words in Context | D | Yes | Strong contrast clue from “rather than long-term measurements” | Pass |

Quality scoring:

- Correct-answer validity: **4/4**
- Single defensible answer: **4/4**
- Plausible, structurally comparable distractors: **4/4**
- Question-to-passage grounding: **4/4**
- Correct and internally consistent explanations: **1/4**
- Appropriate adaptive type selection: **pass**
- Overall editorial readiness: **fail**

### Why the explanation defect matters

This is not cosmetic. A student who reads the feedback is explicitly taught an incorrect mapping between reasoning and answer choices. Because the publish gate checks approval count rather than explanation consistency, an admin can publish this content without any automated warning.

## Authorization audit

Requests below were made without an admin login:

| Endpoint | Actual result | Expected result | Severity |
| --- | --- | --- | --- |
| `GET /api/admin/units` | HTTP 200 | HTTP 401/403 | Critical |
| `GET /api/admin/students` | HTTP 200 | HTTP 401/403 | Critical |
| `POST /api/admin/sources/generate-passages-from-clean-text` with a fake source ID | HTTP 404 “Source not found” | HTTP 401/403 before resource lookup | Critical |
| `POST /api/admin/questions/review` | HTTP 401 | HTTP 401/403 | Pass |

The 404 from the chunking endpoint confirms that the unauthenticated request reached application/database logic. It is not merely a public health response. Route-level authorization is present on the review and lesson-generation routes, but it is not consistently applied across the admin API.

Potential impact includes student-data disclosure, unauthorized source mutation, unintended processing cost, and enumeration of internal records.

## Findings and recommendations

### P0 — Enforce admin authorization on every admin API route

Add `requireAdminApi()` at the start of every handler under `/api/admin`, including all HTTP methods. Do not rely on middleware alone for API protection. Add a test that enumerates admin routes and verifies an unauthenticated request receives 401 or 403 before validation, lookup, or mutation.

At minimum, immediately cover:

- units and students;
- sources create/update/delete;
- clean-text and passage generation;
- uploads, imports, and other cost-bearing generation actions.

### P0 — Validate explanations against option identities

The current structural validator validates distractors but does not catch incorrect letter references in explanations.

Recommended generation contract:

- have the model return an explanation for the correct answer separately;
- return distractor rationales as keyed fields: `A`, `B`, `C`, `D`;
- assemble the final explanation in deterministic code after option ordering/shuffling;
- reject any explanation containing option-letter claims that disagree with `correct_option`;
- preferably avoid letters in generated prose entirely and refer to option text or stable option IDs.

### P1 — Add an editorial-quality publish gate

Before approval or publication, run checks for:

- exactly one passage-supported answer;
- quoted vocabulary word exists in the passage;
- paragraph reference exists;
- explanation agrees with the correct option and distractor identities;
- no unsupported causal or scientific claim;
- no duplicated or near-duplicated options.

The admin UI should show warnings beside the affected question and prevent publishing on hard failures.

### P1 — Improve explanation specificity

Even where the answer is correct, explanations should state why the correct choice is supported and why each distractor fails. Avoid generic phrases such as “distorts the claim” when the actual error is more precise: unsupported causation, contradiction, overstatement, or incomplete scope.

### P2 — Preserve adaptive selection rather than enforcing quotas per chunk

The selected mix covered four of the six requested categories:

- Central Ideas;
- Inferences;
- Text Structure and Purpose;
- Words in Context.

Command of Evidence and Tone were reasonably omitted for this chunk. Coverage of all categories should be monitored across a chapter, book, or assignment—not forced into every passage. Add a dashboard showing recent type distribution and flag only sustained underrepresentation.

### P2 — Add visible generation diagnostics

Show the admin:

- generation duration and cache status;
- analyzer reason and recommended types;
- validation warnings;
- generation version;
- whether regeneration will skip, reuse cache, or replace existing content.

## Recommended regression suite

1. Unauthenticated contract test for every `/api/admin/**` method.
2. Fixed-fixture generation tests for analytical, narrative, historical, and scientific passages.
3. Explanation-letter mutation tests that deliberately swap options after generation.
4. Evidence-grounding tests for vocabulary quotations and paragraph references.
5. Publish-gate test requiring both four approvals and zero hard quality failures.
6. Idempotency test ensuring repeated generation creates no duplicate lesson or questions.
7. Distribution test across a multi-chunk source for all six target question families.

## Exit criteria

This workflow should be considered production-ready only when:

- every admin route rejects unauthenticated requests before doing work;
- generated explanations remain correct after option ordering;
- hard content-quality failures block approval/publication;
- the same regression set passes on at least three different nonfiction sources and one literary source.

## Remediation addendum — 2026-07-29

The two release-blocking defects were fixed and retested.

### Admin authorization

- Migrated the Next.js 16 request boundary from the inactive root `middleware.ts` to `src/proxy.ts`.
- All `/admin`, `/admin/**`, and `/api/admin/**` requests are now checked before reaching a page or handler; only the login routes are exempt.
- Replaced the forgeable literal `sat_admin_session=authorized` cookie with an HMAC-SHA-256-signed, eight-hour session token.
- The signing secret uses `ADMIN_SESSION_SECRET` when configured and falls back to the admin password for backward-compatible local setup.

Regression results:

| Request | Result |
| --- | --- |
| Unauthenticated `GET /api/admin/units` | HTTP 401 |
| Unauthenticated `GET /api/admin/students` | HTTP 401 |
| Unauthenticated passage generation | HTTP 401 |
| Forged `sat_admin_session=authorized` cookie | HTTP 401 |
| Valid login | HTTP 200 |
| Valid signed-cookie request | HTTP 200 |
| Cookie flags | `HttpOnly`; `Secure` in production; `SameSite=Lax` |

### Explanation consistency

- Expanded deterministic option remapping to cover standalone letter references such as “B and C,” not only “option B.”
- Added prompt requirements to use explicit `option A`–`option D` wording.
- Bumped the AI package cache version to `2026-07-29-explanation-remap-v4`, preventing reuse of packages generated under the defective mapping behavior.
- Reset and regenerated only the controlled QA lesson. The replacement remained in `draft`.

The new real AI package was generated in 43.39 seconds. Manual review confirmed:

- 4/4 correct answers are grounded and unique;
- 4/4 explanations identify the correct option after shuffling;
- all distractor-letter references match the stored option text;
- the lesson and all questions remain in `draft`.

### Automated regression

- TypeScript check: pass
- Reading QA suite: pass
- Vocabulary QA suite: pass
- Next.js production build: pass
