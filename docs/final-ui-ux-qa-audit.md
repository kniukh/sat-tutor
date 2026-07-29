# Final UI/UX QA Audit and Duolingo-Style Direction

Date: 2026-07-29  
Environment: local Next.js development build  
Viewports: 390 × 844 mobile and 1440 × 1000 desktop  
Test users: `test2` student and authenticated admin

## Executive summary

Current UI quality: **6.8/10**.

The application is visually consistent, readable, responsive, and already feels like a coherent product rather than an unfinished prototype. The dark navy palette, rounded panels, turquoise primary actions, and typography form a recognizable system. No horizontal overflow was found on the tested pages, images had alternative text, and primary form controls generally fit mobile screens.

However, the student experience currently feels more like a dark SaaS dashboard than a learning game. It emphasizes panels, statistics, and management actions instead of a clear daily learning journey. On mobile, important screens are unnecessarily long, repeated metadata competes with the next action, and there is no persistent student navigation.

The strongest direction is not to visually clone Duolingo. It is to adopt its interaction principles:

- one obvious next action;
- one exercise per screen;
- visible progress and immediate feedback;
- compact motivation signals;
- short sessions and celebratory completion;
- a visual learning path rather than a list of lessons.

The admin panel should remain more restrained and productivity-oriented. It should share tokens with the student product, but should not become game-like.

## Audit method and evidence

The audit used real authenticated browser sessions in installed Chrome, not static component inspection. Screenshots and DOM metrics are stored in:

`test-results/ui-ux-audit/`

Routes tested:

- student login;
- student dashboard, desktop and mobile;
- selected book and reading path;
- completed lesson state;
- vocabulary list;
- vocabulary drill;
- admin sources, desktop and mobile;
- admin students, mobile.

Automated checks included:

- horizontal overflow;
- full-page scroll height;
- missing form labels;
- missing image alternative text;
- touch targets below 44 × 44 px;
- heading hierarchy;
- authenticated redirects.

## Regression discovered and fixed during the audit

Activating the Next.js 16 proxy exposed a redirect loop on `/student/login`. The route was incorrectly classified as part of `/s` because both strings begin with `/s`.

This was fixed by matching only:

- `/s`;
- `/s/**`.

The audit also exposed a mismatch between proxy authorization and server-rendered admin pages. The proxy now passes a protected internal authentication marker to the page request after validating the signed cookie. A caller cannot bypass it with a forged header because unauthenticated requests are rejected before the header is forwarded.

Regression results:

- `/student/login`: HTTP 200;
- authenticated `/s`: HTTP 200;
- authenticated `/admin/sources`: HTTP 200;
- forged internal admin header without a signed cookie: HTTP 401.

## What already works well

### Responsive foundation

- No horizontal overflow at 390 px on any audited screen.
- Cards, inputs, and main actions reflow correctly.
- Book covers preserve useful visual identity.
- Long text wraps without clipping.
- Sticky drill controls remain reachable at the bottom of the screen.

### Visual consistency

- Navy surfaces, thin borders, rounded corners, and turquoise actions are applied consistently.
- Primary and secondary actions are visually distinguishable.
- The reading, vocabulary, and admin areas feel related.
- The interface avoids random colors and inconsistent component shapes.

### Exercise clarity

- Vocabulary drill presents one question per screen.
- Answer options are large and easy to scan.
- Progress is visible at the top.
- Continue remains disabled until a selection is made.
- There are no distracting navigation elements inside the exercise.

### Content hierarchy

- Book cover, title, author, progress, and action are easy to identify.
- Completion state clearly explains that progress was saved.
- Admin source types and book-destination choices are understandable.

## Findings

### P0 — Authentication redirect regression

Status: **fixed during this audit**.

See the regression section above.

### P1 — Vocabulary pagination is duplicated and contradictory

On the same mobile page:

- the summary says `Page 1 of 2`;
- the list heading says `Page 1 of 4`;
- the footer says `1 / 2`;
- two separate Next controls are shown.

Impact:

- students cannot confidently understand how many pages exist;
- the server-pagination improvement appears unreliable;
- duplicate controls add visual weight to an already long page.

Recommendation:

- keep one authoritative `pageCount` from the server;
- show pagination only once at the bottom;
- keep a compact count near the title, but remove a second page indicator;
- use `Previous · 1 of 2 · Next` as one control group.

### P1 — Reading path is a 3,467 px list of nearly identical cards

Thirteen lessons appear as full cards, each with a status label, repeated chapter name, metadata, and full-width action.

Observed content defects:

- `Chapter 1 — Chapter 1 — Part 1`;
- every item displays `Chapter 1 · Lesson 0`;
- available lessons are visually almost identical;
- completed/current/available states do not form a strong path.

Impact:

- excessive scrolling;
- weak sense of progression;
- the current lesson is hard to relocate after scrolling;
- repeated text makes the page feel generated.

Recommendation:

- normalize lesson names to `Part 1`, `Part 2`, and so on under one `Chapter 1` heading;
- correct zero-based lesson numbering;
- render lessons as compact connected nodes or rows;
- collapse completed chapters;
- show only the current chapter expanded;
- keep one sticky `Continue` action.

### P1 — Dashboard prioritizes four large statistics over today's action

The mobile dashboard is approximately 2,048 px high. XP, streak, level, and leaderboard each consume a large card before the reading and vocabulary actions.

Recommendation:

- move XP, streak, and hearts/energy into a compact top status bar;
- make `Continue lesson` the dominant first-screen action;
- show one daily goal card;
- move leaderboard and analytics into secondary navigation;
- reduce the initial dashboard to roughly one viewport plus a small amount of scroll.

### P1 — Admin inputs lack programmatic labels

Missing labels were detected on:

- book name;
- author;
- chapter number;
- chapter name;
- chapter text;
- student full name;
- email;
- access code;
- language selector.

Placeholders are not a replacement for labels because they disappear after entry and are less reliable for screen readers.

Recommendation:

- add visible `<label>` elements;
- connect labels with `htmlFor` and stable input IDs;
- add short helper/error text with `aria-describedby`.

### P1 — Several mobile touch targets are below 44 px

Examples:

- dashboard links: approximately 19–22 px high;
- vocabulary card actions: 40 px high;
- admin navigation: 38 px high;
- admin Delete actions: 28 px high;
- book breadcrumbs: 20 px high.

Recommendation:

- give all interactive elements at least a 44 × 44 px hit area;
- text can remain visually small while padding enlarges the target;
- separate destructive actions from neighboring controls.

### P1 — Access codes are displayed directly in the admin student table

The mobile student list shows every student's usable access code in plain text.

Recommendation:

- mask access codes by default;
- add explicit Reveal and Copy actions;
- record regeneration/copy activity if the application later supports multiple admins;
- avoid showing email and access code together in a compact shoulder-surfable table.

### P1 — Destructive actions are visually too prominent

Every source and vocabulary item displays a visible Delete button. In the source library the Delete control is the most saturated element.

Recommendation:

- move Delete into an overflow menu;
- require a confirmation dialog that names the exact source;
- explain whether lessons and progress will also be affected;
- use red only inside the confirmation step or on hover/focus.

### P2 — Mixed language and tone

The student login page mixes:

- English marketing copy;
- Russian form instructions and button text.

The rest of the student experience is mainly English. This feels accidental rather than intentionally localized.

Recommendation:

- render all UI copy from the student's language preference;
- keep source text and vocabulary translations independent from interface language;
- establish one voice: short, encouraging, active, and age-appropriate.

### P2 — Semantic heading problems

- Student login contains two `<h1>` elements.
- Completed lesson has no `<h1>`.
- Vocabulary drill has no semantic heading.

Recommendation:

- one `<h1>` per screen;
- exercise question should be an `<h1>` or `<h2>` depending on the persistent shell;
- use landmarks for header, main content, progress, and feedback.

### P2 — Vocabulary management is too operational for students

Each word exposes Delete, Regenerate, and Audio. `Regenerate` is an implementation concept and repeated destructive/maintenance actions dominate the learning content.

Recommendation:

- primary card actions: Listen and Practice;
- secondary overflow: Edit meaning, Refresh, Remove;
- show mastery, last reviewed, and next review rather than generation mechanics;
- group weak, new, and mastered words.

### P2 — Admin source creation is too long

The mobile source screen is approximately 2,570 px high. Source creation, cover configuration, chapter entry, and the entire library appear in one continuous page.

Recommendation:

- use a three-step flow: Details → Content → Review;
- make `Create new book` and `Add chapters` distinct entry points;
- move saved sources to their own default list view;
- on desktop, use a left source list and right editor;
- preserve draft form state between steps.

## Duolingo-style product direction

### 1. Student navigation

Add a persistent mobile bottom navigation:

1. Learn
2. Books
3. Words
4. Progress

The active tab should combine icon, label, and color. Keep Feedback and Logout inside Profile/Settings rather than the dashboard hero.

Desktop can use a compact left rail with the same destinations.

### 2. Learning home

Replace the statistics-first dashboard with:

- compact top row: streak, XP, daily goal;
- greeting and a one-line coaching message;
- large `Continue` card showing the next 5–10 minute activity;
- today's path: Reading → Questions → Vocabulary;
- optional secondary card for weak-word review.

Suggested first-screen hierarchy:

1. `Continue: Chapter 1 · Part 2`
2. `Daily goal: 1 of 3 activities`
3. streak and XP
4. optional challenge

### 3. Book path

Turn lessons into a vertical journey:

```text
Chapter 1
   ● Part 1 ✓
   │
   ● Part 2 ← Continue
   │
   ○ Part 3
   │
   🔒 Chapter checkpoint
```

States:

- completed: colored node with check;
- current: larger animated node;
- available: outlined node;
- locked: low-contrast lock;
- checkpoint: distinct trophy or flag node.

Do not lock every future lesson unless pedagogically necessary. The visual can communicate recommendation without removing learner control.

### 4. Exercise player

Keep the existing one-question-per-screen foundation and add:

- close button and progress segments at the top;
- question category label in plain language;
- large selectable answer cards with pressed depth;
- sticky bottom Check button;
- immediate green/red feedback sheet;
- explanation followed by `Continue`;
- optional `Explain differently` action;
- short completion celebration with XP gained.

For reading questions on mobile:

- use a Passage/Question segmented switch;
- remember scroll position in the passage;
- highlight cited evidence after submission;
- avoid forcing the student to scroll between passage and options repeatedly.

### 5. Motivation without over-gamification

Recommended:

- daily goal;
- streak with a forgiving streak-freeze mechanism;
- XP for completing meaningful work;
- chapter checkpoints;
- small achievement animations;
- personal-best accuracy;
- weekly progress summary.

Avoid:

- punishing learners for reading slowly;
- excessive red failure states;
- random rewards unrelated to learning;
- leaderboard pressure as the primary motivation;
- hearts that block practice.

For SAT preparation, progress should feel serious and credible. Use game mechanics to reinforce consistency, not to trivialize difficult reading.

### 6. Visual language

Suggested student palette:

- primary learning green: `#58CC02`;
- pressed green: `#46A302`;
- vocabulary blue: `#1CB0F6`;
- challenge purple: `#CE82FF`;
- streak orange: `#FF9600`;
- error coral: `#FF4B4B`;
- light page background: `#F7F9FC`;
- dark text: `#243B53`.

The current turquoise can remain as the product signature, but it needs brighter supporting colors and lighter surfaces.

Typography:

- rounded display face such as Nunito Sans for student headings;
- Inter or the existing system face for admin and long reading passages;
- 700–800 weight for actions;
- avoid letter-spaced uppercase labels on every card.

Components:

- chunky buttons with a 3–4 px darker bottom edge;
- 16–20 px card radius;
- fewer nested bordered cards;
- friendly illustrations or abstract book/brain characters;
- subtle bounce/confetti only at meaningful completion points.

### 7. Admin direction

Do not apply the full playful student aesthetic to admin.

Admin should use:

- light neutral background;
- dense but readable tables;
- clear status chips;
- persistent filters;
- split-view editors;
- generation progress and logs;
- warning/error states;
- review queues.

Share brand color, typography, icons, and radius tokens, but prioritize speed and information density.

## Suggested redesign options

### Option A — Evolutionary refresh

Keep the current dark visual identity and implement:

- bottom navigation;
- compact dashboard metrics;
- connected lesson path;
- unified pagination;
- better labels and touch targets;
- stronger feedback animations.

Effort: lowest.  
Risk: lowest.  
Duolingo resemblance: moderate.

### Option B — Bright learning mode, professional admin

Create two related themes:

- bright, playful student experience;
- clean, restrained admin experience.

Reuse existing data and component behavior while redesigning the student shell, dashboard, path, and exercise feedback.

Effort: medium.  
Risk: manageable.  
Duolingo resemblance: strong without becoming a clone.

### Option C — Full learning-game redesign

Add a mascot, illustrated worlds, animated path, leagues, quests, rewards, and a new navigation model.

Effort: high.  
Risk: high because visual polish could outpace pedagogy and content quality.  
Recommendation: postpone until the core lesson loop has enough student usage data.

**Recommended option: B.**

## Prioritized implementation roadmap

### Phase 1 — UX correctness

1. Fix conflicting vocabulary pagination.
2. Normalize chapter/lesson names and remove `Lesson 0`.
3. Add form labels and 44 px touch targets.
4. Mask student access codes.
5. Move destructive actions behind confirmation/overflow menus.
6. Standardize interface language.

### Phase 2 — Student shell

1. Add bottom navigation and desktop rail.
2. Redesign dashboard around the next activity.
3. Compact streak/XP/goal into one header.
4. Convert the book list into a connected path.

### Phase 3 — Learning feedback

1. Add answer-state animation and feedback sheet.
2. Highlight passage evidence.
3. Add lesson completion celebration and XP summary.
4. Add daily goal and weekly progress.

### Phase 4 — Brand delight

1. Introduce the bright student palette.
2. Add a small original guide character or abstract visual system.
3. Add lightweight motion with reduced-motion support.
4. Test multiple variants with actual students.

## Acceptance criteria for the redesigned student experience

- The next learning action is visible without scrolling on a 390 × 844 screen.
- Dashboard primary content fits within approximately 1.25 mobile viewports.
- All touch targets are at least 44 × 44 px.
- Each page has one clear `<h1>`.
- No contradictory pagination or progress values.
- Current lesson can be found within two seconds.
- One exercise, one decision, and one primary action appear at a time.
- Correct/incorrect feedback is understandable without relying only on color.
- The interface respects reduced-motion settings.
- Student and admin interfaces use consistent tokens but appropriate levels of playfulness.

