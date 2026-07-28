export type AdminQuestionPromptRouteId =
  | "main_idea"
  | "central_claim"
  | "detail"
  | "inference"
  | "command_of_evidence"
  | "function"
  | "text_structure"
  | "tone"
  | "cause_effect"
  | "summary"
  | "vocabulary_in_context"
  | "meaning_in_context"
  | "translation"
  | "definition"
  | "vocabulary_translation"
  | "vocabulary_definition";

export type QuestionPromptRoute = {
  id: AdminQuestionPromptRouteId;
  category: "reading" | "vocabulary";
  canonicalQuestionType: string;
  goal: string;
  reasoningFocus: string[];
  answerRules: string[];
  distractorPatterns: string[];
  requiredDistractorTypes?: string[];
  styleNormalization: string[];
  validationRules: string[];
  outputHint: string;
};

export const QUESTION_PROMPT_MAP: Record<AdminQuestionPromptRouteId, QuestionPromptRoute> = {
  main_idea: {
    id: "main_idea",
    category: "reading",
    canonicalQuestionType: "main_idea",
    goal: "Test understanding of the passage's central claim, purpose, or overall point.",
    reasoningFocus: [
      "Anchor the question in the whole passage, not one isolated sentence.",
      "Force the student to weigh scope, purpose, and the author's actual claim.",
      "Make the best answer depend on careful reading rather than keyword recognition.",
    ],
    answerRules: [
      "All options must be similar in length, structure, and tone.",
      "The correct answer must match the scope of the full passage, not just one detail.",
      "The student should need to understand the passage as a whole, not just spot a keyword.",
    ],
    distractorPatterns: [
      "too_broad: generalizes the passage beyond its actual claim",
      "too_narrow: focuses on a specific detail instead of the full central idea",
      "misinterpretation: distorts the author's point while still sounding plausible",
      "keyword_trap: reuses passage language but applies it to the wrong overall claim",
    ],
    requiredDistractorTypes: ["too_broad", "too_narrow", "misinterpretation"],
    styleNormalization: [
      "Keep all options parallel in grammar and abstraction level.",
      "Avoid one option sounding more polished, more detailed, or more cautious than the others.",
    ],
    validationRules: [
      "At least two distractors should remain plausible after a close reread of the passage.",
      "Reject any option set where the correct answer is visibly more precise or balanced than the rest.",
      "If one answer can be eliminated immediately by scope mismatch alone, rewrite the full set.",
    ],
    outputHint:
      "When possible, keep one distractor in each of these exact trap buckets: too_broad, too_narrow, misinterpretation.",
  },
  central_claim: {
    id: "central_claim",
    category: "reading",
    canonicalQuestionType: "central_claim",
    goal: "Test the author's central claim or controlling idea, distinct from the broader purpose of the passage.",
    reasoningFocus: [
      "Make the student identify what the passage actually argues or establishes.",
      "Keep the correct answer narrower than a main-purpose answer but broader than a detail.",
      "Force attention to the author's claim, not merely the passage topic.",
    ],
    answerRules: [
      "All options must be plausible claims about the passage's subject.",
      "The correct answer must state the best-supported central claim.",
      "Avoid options that are only themes, topics, or isolated facts.",
    ],
    distractorPatterns: [
      "topic_only: names the subject but not the claim",
      "too_narrow: turns one detail into the main claim",
      "distorted_claim: sounds argumentative but reverses or warps the passage's point",
    ],
    requiredDistractorTypes: ["topic_only", "too_narrow", "distorted_claim"],
    styleNormalization: [
      "Keep all options claim-like and parallel in abstraction.",
      "Avoid making the correct answer the only option with a clear verb or thesis shape.",
    ],
    validationRules: [
      "At least two distractors should sound like possible claims until the passage logic is checked.",
      "Reject options that can be eliminated only because they are not grammatically claim-like.",
      "If the correct answer is just a main idea paraphrase, sharpen it into a claim.",
    ],
    outputHint:
      "Use this when the passage argues, evaluates, or establishes a position rather than merely describing a topic.",
  },
  detail: {
    id: "detail",
    category: "reading",
    canonicalQuestionType: "detail",
    goal: "Test precise understanding of what the passage directly states or clearly supports.",
    reasoningFocus: [
      "Make the student verify exact textual support instead of grabbing a nearby phrase.",
      "Reward careful reading of what the text actually says, not what it loosely suggests.",
    ],
    answerRules: [
      "All options must feel text-grounded and equally plausible.",
      "The correct answer must be supported by the passage, not by outside knowledge.",
      "Avoid giveaway wording differences or one option that is much more specific than the rest.",
    ],
    distractorPatterns: [
      "scope_shift: uses a nearby passage detail but answers a slightly different question",
      "too_broad: expands one detail into a larger claim the passage does not make",
      "keyword_trap: reuses passage language but attaches it to the wrong idea",
    ],
    styleNormalization: [
      "Keep all options text-based, specific, and similar in sentence shape.",
      "Do not let one option stand out by quoting the passage more directly than the others.",
    ],
    validationRules: [
      "At least two answer choices should feel directly tied to the passage.",
      "Reject any set where the correct answer is the only option with precise textual support.",
      "If a distractor becomes obviously wrong because it leaves the text entirely, rewrite it.",
    ],
    outputHint:
      "Make distractors look text-based, not random, so the student must verify the exact support in the passage.",
  },
  inference: {
    id: "inference",
    category: "reading",
    canonicalQuestionType: "inference",
    goal: "Test what the passage strongly suggests rather than what it states word-for-word.",
    reasoningFocus: [
      "Build the answer around a warranted conclusion, not a surface restatement.",
      "Force the student to connect evidence across lines or ideas before choosing.",
      "Make the best answer feel supported but not directly copied from the passage.",
    ],
    answerRules: [
      "All options must be similar in length, structure, and tone.",
      "The correct answer must be supported by the passage, but not directly copied from it.",
      "The student should need to reason from evidence in the passage.",
    ],
    distractorPatterns: [
      "overreach: goes beyond what the passage reasonably supports",
      "too_literal: restates surface detail instead of making the inference",
      "misinterpretation: draws the wrong conclusion from the evidence",
      "keyword_trap: reuses passage language but turns it into an unsupported conclusion",
    ],
    requiredDistractorTypes: ["overreach", "too_literal", "misinterpretation"],
    styleNormalization: [
      "Keep all options similar in confidence level and abstraction.",
      "Avoid making the correct answer the only carefully qualified option.",
    ],
    validationRules: [
      "At least two distractors should sound supportable until the student checks the evidence trail carefully.",
      "Reject any answer set where the correct answer is the only option with nuanced wording.",
      "If a distractor is obviously too extreme, revise all options to restore balance.",
    ],
    outputHint:
      "Keep all options plausible for a student who half-understands the evidence trail.",
  },
  command_of_evidence: {
    id: "command_of_evidence",
    category: "reading",
    canonicalQuestionType: "command_of_evidence",
    goal: "Test which piece of textual evidence best supports a claim or inference.",
    reasoningFocus: [
      "Make the student connect an answer to the strongest supporting evidence.",
      "Use short quoted or paraphrased evidence snippets from the passage as answer choices.",
      "The best answer should support the specific claim in the question, not just relate to the topic.",
    ],
    answerRules: [
      "All options must be evidence-like and grounded in the passage.",
      "The correct answer must directly support the asked claim or inference.",
      "Distractors should be true or text-adjacent but support a different point.",
    ],
    distractorPatterns: [
      "true_but_wrong_claim: accurate evidence that supports another idea",
      "nearby_context: adjacent text that does not prove the claim",
      "keyword_trap: repeats key words without supporting the reasoning",
    ],
    requiredDistractorTypes: ["true_but_wrong_claim", "nearby_context", "keyword_trap"],
    styleNormalization: [
      "Keep evidence choices similar in length and form.",
      "Avoid one option being the only direct quote if the others are paraphrases, or vice versa.",
    ],
    validationRules: [
      "At least two evidence choices should feel relevant before careful reasoning.",
      "Reject answer sets where the correct evidence is the only option from the relevant paragraph.",
      "The explanation must name why the evidence proves the claim.",
    ],
    outputHint:
      "Phrase the question as evidence selection, for example: Which choice best supports the conclusion that...?",
  },
  function: {
    id: "function",
    category: "reading",
    canonicalQuestionType: "function",
    goal: "Test the rhetorical role of a sentence, detail, example, or paragraph.",
    reasoningFocus: [
      "Make the student explain why the author included a specific element.",
      "Tie the correct answer to the passage's structure or argument.",
      "Avoid asking what the element says; ask what it does.",
    ],
    answerRules: [
      "All options must describe rhetorical functions, not content summaries.",
      "The correct answer must explain the role of the referenced element in context.",
      "Distractors should describe plausible functions that do not match this passage.",
    ],
    distractorPatterns: [
      "content_summary: states what the line says instead of what it does",
      "wrong_function: plausible rhetorical role but not the actual one",
      "scope_shift: describes the role of a larger or smaller section",
    ],
    requiredDistractorTypes: ["content_summary", "wrong_function", "scope_shift"],
    styleNormalization: [
      "Start options with parallel function verbs when possible.",
      "Keep all options at the same level of abstraction.",
    ],
    validationRules: [
      "Reject any option set where only the correct answer is phrased as a function.",
      "At least two distractors should sound rhetorically plausible.",
      "The explanation must connect the element to surrounding passage logic.",
    ],
    outputHint:
      "Use wording like: The sentence primarily serves to... or The example is included mainly to...",
  },
  text_structure: {
    id: "text_structure",
    category: "reading",
    canonicalQuestionType: "text_structure",
    goal: "Test how the passage or a section is organized.",
    reasoningFocus: [
      "Make the student track progression, contrast, cause/effect, problem/solution, or claim/evidence.",
      "The correct answer should describe the movement of ideas, not just the topic.",
      "Distractors should capture partial structure but miss the whole development.",
    ],
    answerRules: [
      "All options must describe organizational patterns.",
      "The correct answer must match the order and relationship of ideas in the passage.",
      "Avoid one option that is much more complete or nuanced than all others.",
    ],
    distractorPatterns: [
      "partial_structure: describes only one section",
      "reversed_order: gets the relationship but reverses the sequence",
      "wrong_relationship: substitutes contrast, cause, example, or claim/evidence incorrectly",
    ],
    requiredDistractorTypes: ["partial_structure", "reversed_order", "wrong_relationship"],
    styleNormalization: [
      "Keep all options as structural descriptions.",
      "Use parallel verbs such as introduces, contrasts, explains, illustrates, challenges.",
    ],
    validationRules: [
      "At least two options should feel possible without rereading the whole passage.",
      "Reject any set where the correct answer is the only two-part structure.",
      "The explanation must mention the actual sequence of ideas.",
    ],
    outputHint:
      "Use when a passage has clear development across paragraphs or sentence groups.",
  },
  tone: {
    id: "tone",
    category: "reading",
    canonicalQuestionType: "tone",
    goal: "Test the author's attitude, emotional register, or rhetorical stance.",
    reasoningFocus: [
      "Make the student read for attitude and rhetorical posture, not just subject matter.",
      "Keep the best answer tied to how the author sounds, not what the passage is about.",
    ],
    answerRules: [
      "All options must be similar in register and abstraction level.",
      "The correct answer must match the tone of the relevant passage lines, not just the topic.",
      "Avoid clearly exaggerated or silly tone words unless the passage itself is extreme.",
    ],
    distractorPatterns: [
      "tone_mismatch: close in attitude but not the best fit",
      "intensity_shift: too strong or too weak compared with the passage",
      "context_misread: based on the subject matter rather than the author's attitude",
    ],
    styleNormalization: [
      "Keep tone words equally literary and equally subtle.",
      "Avoid one option standing out as much more dramatic or much more plain than the others.",
    ],
    validationRules: [
      "At least two options should feel arguable before the student attends to tone precisely.",
      "Reject any set with a cartoonishly extreme distractor.",
      "If one option is the only nuanced adjective pair, rebalance the set.",
    ],
    outputHint:
      "Make tone distractors subtle, not cartoonish, so they feel genuinely arguable at first glance.",
  },
  cause_effect: {
    id: "cause_effect",
    category: "reading",
    canonicalQuestionType: "cause_effect",
    goal: "Test causal or consequential relationships stated or strongly implied by the passage.",
    reasoningFocus: [
      "Make the student identify why something happened or what resulted from it.",
      "Tie the correct answer to passage logic, not outside knowledge.",
      "Distractors should confuse sequence, correlation, and causation.",
    ],
    answerRules: [
      "All options must be plausible causes or effects.",
      "The correct answer must reflect the passage's causal logic.",
      "Avoid options that merely repeat events without explaining the relationship.",
    ],
    distractorPatterns: [
      "sequence_not_cause: happened nearby but did not cause the result",
      "reversed_causality: swaps cause and effect",
      "outside_reasoning: plausible from background knowledge but unsupported by the passage",
    ],
    requiredDistractorTypes: ["sequence_not_cause", "reversed_causality", "outside_reasoning"],
    styleNormalization: [
      "Keep all options causally phrased.",
      "Avoid one option having a uniquely explicit because/therefore structure.",
    ],
    validationRules: [
      "At least two distractors should be tempting causal explanations.",
      "Reject any answer set where the correct answer is the only option mentioned in the passage.",
      "The explanation must identify the causal link in the text.",
    ],
    outputHint:
      "Use wording like: The passage suggests that X occurred primarily because...",
  },
  summary: {
    id: "summary",
    category: "reading",
    canonicalQuestionType: "summary",
    goal: "Test whether the student can compress the passage or section into the best concise summary.",
    reasoningFocus: [
      "Make the student include the central point and key development while excluding minor detail.",
      "The correct answer should be concise but complete.",
      "Distractors should be too narrow, too broad, or misweighted.",
    ],
    answerRules: [
      "All options must read like summaries.",
      "The correct answer must capture the central idea and major development.",
      "Avoid one option being obviously longer or more polished.",
    ],
    distractorPatterns: [
      "too_narrow: summarizes only one detail or section",
      "too_broad: makes a general statement beyond the passage",
      "misweighted: emphasizes a secondary point as if it were central",
    ],
    requiredDistractorTypes: ["too_narrow", "too_broad", "misweighted"],
    styleNormalization: [
      "Keep all summaries similar in length and abstraction.",
      "Avoid quoting passage wording in only one option.",
    ],
    validationRules: [
      "At least two summaries should sound viable until scope is checked.",
      "Reject any option that introduces outside information.",
      "The explanation must mention why the correct summary has the right scope.",
    ],
    outputHint:
      "Use for passages with enough development to summarize meaningfully.",
  },
  vocabulary_in_context: {
    id: "vocabulary_in_context",
    category: "vocabulary",
    canonicalQuestionType: "vocabulary_in_context",
    goal: "Test the meaning of a word as it is used in this specific sentence or passage context.",
    reasoningFocus: [
      "Make the student use local context to choose the best meaning.",
      "Treat the answer as a best fit for this sentence, not a generic dictionary lookup.",
    ],
    answerRules: [
      "All options must belong to the same semantic field and feel equally plausible.",
      "The correct answer must reflect contextual meaning, not just a generic dictionary meaning.",
      "The student should need to understand the local sentence, not just recognize a familiar definition.",
    ],
    distractorPatterns: [
      "near_synonym: close in meaning, but not the best fit here",
      "wrong_dictionary_meaning: a real meaning of the word, but not the one used in context",
      "partial_meaning: captures only part of the contextual meaning",
    ],
    requiredDistractorTypes: ["near_synonym", "wrong_dictionary_meaning", "partial_meaning"],
    styleNormalization: [
      "Keep all choices in the same semantic field, with similar length and register.",
      "Avoid one option standing out as much more technical or much more broad than the others.",
    ],
    validationRules: [
      "At least two distractors should sound workable until the reader checks the sentence context carefully.",
      "Reject any answer set with an unrelated or obviously opposite meaning.",
      "If one option is the only context-sensitive phrase, rebalance the full set.",
    ],
    outputHint:
      "Keep distractors semantically nearby so the student cannot guess without understanding the context.",
  },
  meaning_in_context: {
    id: "meaning_in_context",
    category: "vocabulary",
    canonicalQuestionType: "vocabulary_in_context",
    goal: "Test the meaning of a word in this specific context, not a standalone definition.",
    reasoningFocus: [
      "Make context do the deciding, not just familiarity with the word.",
      "Treat the correct answer as the most precise fit for this sentence.",
    ],
    answerRules: [
      "All options must be similar in length, tone, and semantic field.",
      "The correct answer must fit the context precisely.",
      "Each distractor should reflect a realistic contextual misunderstanding.",
    ],
    distractorPatterns: [
      "near_synonym: close in meaning, but contextually wrong",
      "context_mismatch: plausible generally, but not in this sentence",
      "tone_mismatch: similar idea, but wrong tone or intensity",
    ],
    styleNormalization: [
      "Keep all choices parallel in tone and specificity.",
      "Avoid a single option standing out as the only phrase that clearly fits the sentence grammar.",
    ],
    validationRules: [
      "At least two options should survive first-pass elimination until the student rereads the sentence.",
      "Reject any distractor that is obviously unrelated to the local context.",
      "If the correct answer is the only polished contextual fit, rewrite the whole set.",
    ],
    outputHint:
      "Treat this as the same production bucket as vocabulary_in_context, but keep the prompt wording explicitly context-first.",
  },
  translation: {
    id: "translation",
    category: "vocabulary",
    canonicalQuestionType: "vocabulary_translation",
    goal: "Test whether the student knows the best translation or closest meaning for the target word in context.",
    reasoningFocus: [
      "Make the student choose the best translation for this context, not just a loose gloss.",
      "Keep distractors close enough that partial knowledge will not be enough.",
    ],
    answerRules: [
      "All options must belong to the same semantic field and feel equally plausible.",
      "The correct answer must be the best translation for this context, not just a broad approximate gloss.",
      "Avoid random or obviously unrelated translations.",
    ],
    distractorPatterns: [
      "near_translation: a close but not exact translation",
      "partial_translation: captures only part of the meaning",
      "common_confusion: a realistic learner confusion with a semantically related word",
    ],
    styleNormalization: [
      "Keep all translations similar in specificity, register, and length.",
      "Avoid making the correct answer noticeably more precise than the distractors.",
    ],
    validationRules: [
      "At least two distractors should look like viable translations at first glance.",
      "Reject any set with an unrelated translation or obvious false friend.",
      "If one option is the only idiomatic phrase, rebalance the set.",
    ],
    outputHint:
      "Keep all answer choices parallel in tone and specificity so the student cannot eliminate by style.",
  },
  definition: {
    id: "definition",
    category: "vocabulary",
    canonicalQuestionType: "vocabulary_definition",
    goal: "Test the most accurate definition of the target word while keeping options highly plausible.",
    reasoningFocus: [
      "Make the student distinguish the most precise definition from close semantic neighbors.",
      "Keep the correct answer as the best definition, not simply a true one.",
    ],
    answerRules: [
      "All options must be similar in length, structure, and semantic field.",
      "The correct answer must be precise without sounding unusually polished.",
      "Distractors should reflect realistic learner confusion, not random unrelated meanings.",
    ],
    distractorPatterns: [
      "near_definition: close in meaning, but not exact",
      "partial_definition: captures only one part of the meaning",
      "common_misunderstanding: a realistic but incorrect interpretation",
    ],
    styleNormalization: [
      "Keep all definition options parallel in phrasing and abstraction level.",
      "Avoid making the correct answer the only option with precise wording.",
    ],
    validationRules: [
      "At least two distractors should remain plausible without close semantic discrimination.",
      "Reject any set with a distractor from a different semantic field.",
      "If one answer is obviously the most polished definition, rebalance the full set.",
    ],
    outputHint:
      "Make all options definition-like and equally credible at first glance.",
  },
  vocabulary_translation: {
    id: "vocabulary_translation",
    category: "vocabulary",
    canonicalQuestionType: "vocabulary_translation",
    goal: "Test whether the student knows the best translation or closest meaning for the target word in context.",
    reasoningFocus: [
      "Make the student choose the best translation for this context, not just a loose gloss.",
      "Keep distractors close enough that partial knowledge will not be enough.",
    ],
    answerRules: [
      "All options must belong to the same semantic field and feel equally plausible.",
      "The correct answer must be the best translation for this context, not just a broad approximate gloss.",
      "Avoid random or obviously unrelated translations.",
    ],
    distractorPatterns: [
      "near_translation: a close but not exact translation",
      "partial_translation: captures only part of the meaning",
      "common_confusion: a realistic learner confusion with a semantically related word",
    ],
    styleNormalization: [
      "Keep all translations similar in specificity, register, and length.",
      "Avoid making the correct answer noticeably more precise than the distractors.",
    ],
    validationRules: [
      "At least two distractors should look like viable translations at first glance.",
      "Reject any set with an unrelated translation or obvious false friend.",
      "If one option is the only idiomatic phrase, rebalance the set.",
    ],
    outputHint:
      "Keep all answer choices parallel in tone and specificity so the student cannot eliminate by style.",
  },
  vocabulary_definition: {
    id: "vocabulary_definition",
    category: "vocabulary",
    canonicalQuestionType: "vocabulary_definition",
    goal: "Test the most accurate definition of the target word while keeping options highly plausible.",
    reasoningFocus: [
      "Make the student distinguish the most precise definition from close semantic neighbors.",
      "Keep the correct answer as the best definition, not simply a true one.",
    ],
    answerRules: [
      "All options must be similar in length, structure, and semantic field.",
      "The correct answer must be precise without sounding unusually polished.",
      "Distractors should reflect realistic learner confusion, not random unrelated meanings.",
    ],
    distractorPatterns: [
      "near_definition: close in meaning, but not exact",
      "partial_definition: captures only one part of the meaning",
      "common_misunderstanding: a realistic but incorrect interpretation",
    ],
    styleNormalization: [
      "Keep all definition options parallel in phrasing and abstraction level.",
      "Avoid making the correct answer the only option with precise wording.",
    ],
    validationRules: [
      "At least two distractors should remain plausible without close semantic discrimination.",
      "Reject any set with a distractor from a different semantic field.",
      "If one answer is obviously the most polished definition, rebalance the full set.",
    ],
    outputHint:
      "Make all options definition-like and equally credible at first glance.",
  },
};

export type UnifiedPromptRouter = {
  version: string;
  routes: QuestionPromptRoute[];
};

const DEFAULT_PROMPT_ROUTES = [
  "main_idea",
  "central_claim",
  "detail",
  "inference",
  "command_of_evidence",
  "function",
  "text_structure",
  "tone",
  "cause_effect",
  "summary",
  "vocabulary_in_context",
  "definition",
  "translation",
] satisfies AdminQuestionPromptRouteId[];

export function getPromptRoute(value: string | null | undefined): AdminQuestionPromptRouteId {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized.includes("main")) {
    return "main_idea";
  }

  if (normalized.includes("central") || normalized.includes("claim")) {
    return "central_claim";
  }

  if (normalized.includes("evidence")) {
    return "command_of_evidence";
  }

  if (normalized.includes("function") || normalized.includes("rhetorical") || normalized.includes("role")) {
    return "function";
  }

  if (normalized.includes("structure") || normalized.includes("organization")) {
    return "text_structure";
  }

  if (normalized.includes("cause") || normalized.includes("effect")) {
    return "cause_effect";
  }

  if (normalized.includes("summary") || normalized.includes("summar")) {
    return "summary";
  }

  if (normalized.includes("detail")) {
    return "detail";
  }

  if (normalized.includes("tone")) {
    return "tone";
  }

  if (normalized.includes("translation")) {
    return "translation";
  }

  if (normalized.includes("definition")) {
    return "definition";
  }

  if (
    normalized.includes("meaning_in_context") ||
    normalized.includes("vocabulary_in_context") ||
    normalized.includes("vocab_in_context")
  ) {
    return "meaning_in_context";
  }

  if (normalized.includes("inference")) {
    return "inference";
  }

  return "vocabulary_in_context";
}

export function renderPromptRouteBlock(value: string | null | undefined) {
  return JSON.stringify(QUESTION_PROMPT_MAP[getPromptRoute(value)], null, 2);
}

export function renderUnifiedPromptRouter(params?: {
  routeIds?: Array<string | null | undefined>;
}) {
  const routeIds = (params?.routeIds ?? [])
    .map((value) => getPromptRoute(value))
    .filter((value, index, array) => array.indexOf(value) === index);

  const resolvedRouteIds = routeIds.length > 0 ? routeIds : DEFAULT_PROMPT_ROUTES;

  const payload: UnifiedPromptRouter = {
    version: "v2_college_board",
    routes: resolvedRouteIds.map((id) => QUESTION_PROMPT_MAP[id]),
  };

  return JSON.stringify(payload, null, 2);
}

export function buildAdminQuestionPromptRouter(params?: {
  routeIds?: Array<string | null | undefined>;
}): UnifiedPromptRouter {
  return JSON.parse(renderUnifiedPromptRouter(params)) as UnifiedPromptRouter;
}

export function renderAdminQuestionPromptRouter(params?: {
  routeIds?: Array<string | null | undefined>;
}) {
  return renderUnifiedPromptRouter(params);
}

export function normalizePromptRouteId(value: string | null | undefined) {
  return getPromptRoute(value);
}

export function getAdminQuestionPromptRoute(value: string | null | undefined) {
  return QUESTION_PROMPT_MAP[getPromptRoute(value)];
}
