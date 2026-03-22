SAT AI Tutor — Full Technical Specification
1. Product Vision
SAT AI Tutor is an AI-powered platform designed to prepare students for the SAT Reading section
through full-book reading methodology. Instead of isolated passages, students read complete books
split into structured passages. The system integrates vocabulary learning, comprehension testing, and
writing development into one continuous learning loop.
2. Architecture
Frontend: - Next.js 15 (App Router) - TypeScript - TailwindCSS Backend: - Supabase (PostgreSQL +
Auth) - API Routes (Next.js) AI Layer: - OpenAI GPT-5 - Services: Analyzer, Generator, Vocabulary AI,
Structure Detector Core Modules: - Lesson Engine - Vocabulary System - PDF Processing Pipeline 
Admin Panel - Analytics Engine
3. Database Overview
Key Tables: - students - lessons - generated_passages - source_documents 
source_document_pages - source_document_structure - source_document_clean_text 
vocabulary_items - student_lesson_state Relationships: - source_document → pages → clean_text →
passages → lessons
4. Lesson Flow
Stages: 1. First Read — student reads and collects unknown words 2. Vocabulary Review — AI
explains words (translation + meaning) 3. Second Read — deeper comprehension 4. Questions —
SAT-style + vocabulary questions 5. Completion — scoring and analytics UI: - Split screen (passage +
workspace) - Draggable divider - HUD with progress tracking
5. Lesson Player
Features: - One-question-at-a-time interface - Keyboard navigation (1–4, arrows, enter) - Autosave
answers - Resume session - Progress tracking - Submit → scoring + analytics Data: - answers JSON 
weak skills detection - vocabulary tracking
6. AI System
AI is used in multiple layers: - Passage Analyzer (difficulty, role, vocab density) - Question Generator 
Vocabulary explanation generator - PDF structure detection Analyzer V2 outputs: - difficulty 
text_mode - vocab_density - phrase_density - recommended questions - vocab targets
7. PDF Pipeline
Steps: 1. Upload PDF 2. Extract pages 3. Detect structure (chapters, body) 4. Clean text 5. Split into
chapters 6. Chunk into passages 7. Analyze passages Challenges: - noisy extraction - headers/footers- chapter detection
8. Features
Done: - Lesson system - Vocabulary flow - Admin panel - Passage generation - AI explanations In
Progress: - PDF pipeline - Analyzer V2 - Vocabulary expansion Planned: - Review mode 
Achievements - Adaptive difficulty - Audio system - Parent dashboard
9. Current Problems- PDF text extraction quality - Weak chapter detection - Lack of preprocessing before AI - No hybrid
rule+AI system yet - Limited vocabulary intelligence
10. Roadmap
Phase 1: - Improve PDF cleaning - Fix structure detection Phase 2: - Analyzer V2 rollout 
Vocabulary-heavy question generation Phase 3: - Review system - Audio integration Phase 4: 
Adaptive learning engine - Full analytics dashboard Phase 5: - Scaling content library
11. Future Vision
The system evolves into a fully adaptive SAT preparation platform where: - Content is auto-generated
from books - AI adapts difficulty per student - Vocabulary becomes personalized - Writing improves with
continuous feedback Goal: Replace traditional SAT prep with AI-driven learning system.
