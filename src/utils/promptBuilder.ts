import type {
  AntiCheatOptions,
  QuestionType,
  TemplateMode,
} from '../types/quiz';

export type DifficultyMode = 'auto' | 'easy' | 'medium' | 'hard' | 'custom';

// Settings the app applies itself; none of them is sent to the AI
export interface TestConfig {
  // Optional: when empty the quiz keeps the title written in its JSON
  title: string;
  timeLimitMinutes: number;
  templateMode: TemplateMode;
  antiCheat: AntiCheatOptions;
}

// What the "Order Easy to Hard" chip adds to the notes. The import check looks
// for this text in the notes to know the order was asked for.
export const easyToHardText =
  'When the questions have more than one difficulty, order them from easiest to hardest: all easy questions first, then medium, then hard, so the difficulty tag never goes down from the first question to the last.';

// What the AI is asked to write
export interface PromptOptions {
  questionCount: number;
  difficulty: DifficultyMode;
  // Percentages, only used when difficulty is 'custom'
  mix: { easy: number; medium: number; hard: number };
  topics: string;
  types: QuestionType[];
  notes: string;
}

export const defaultTestConfig: TestConfig = {
  title: '',
  timeLimitMinutes: 15,
  templateMode: 'paginated',
  antiCheat: {
    enabled: false,
    tabLock: true,
    uiRestrictions: true,
    fullscreenLock: true,
  },
};

// Only the difficulty has a default; the rest must be chosen before building
export const defaultPromptOptions: PromptOptions = {
  questionCount: 0,
  difficulty: 'auto',
  mix: { easy: 30, medium: 50, hard: 20 },
  topics: '',
  types: [],
  notes: '',
};

const TYPE_RULES: Record<QuestionType, string> = {
  mcq: '"mcq" (single correct answer)',
  'multi-select': '"multi-select" (multiple correct answers — return as array)',
  'true-false': '"true-false" (True / False only)',
  'short-answer': '"short-answer" (direct text entry, no options)',
  'multi-blank':
    '"multi-blank" (fill-in-the-blanks, use the literal string [BLANK] as placeholders in the prompt)',
};

function difficultyRules({ difficulty, mix }: PromptOptions): string {
  switch (difficulty) {
    case 'easy':
      return `Difficulty: Easy
  - Questions should test direct recall and definition application.
  - The student should be able to answer from reading the material once.`;
    case 'medium':
      return `Difficulty: Medium
  - Questions should require applying a concept to a concrete situation.
  - A student who only memorised bullet points should struggle.`;
    case 'hard':
      return `Difficulty: Hard
  - Questions should force the student to reconcile two ideas that are individually familiar, or notice that a plausible option fails exactly one constraint.
  - If a question can be answered by pattern-matching a slide bullet, it is NOT hard.`;
    case 'custom':
      return `Difficulty Distribution: ${mix.easy}% Easy, ${mix.medium}% Medium, ${mix.hard}% Hard.
  - Easy: direct recall / definition.
  - Medium: apply a concept to a situation — memorising bullet points is not enough.
  - Hard: reconcile two familiar ideas, or spot that a plausible option fails one constraint.`;
    default:
      return `Difficulty: Balanced mix. Apply these calibration rules:
  - Easy: direct recall / definition application.
  - Medium: apply a concept to a concrete situation.
  - Hard: reconcile two familiar ideas, or notice a plausible-looking option fails exactly one constraint.
  - Litmus test: if the answer can be found by pattern-matching a bullet point from the slides, it is Easy at best.`;
  }
}

// Returns why the prompt cannot be used yet, or null when it is ready
// Everything still wrong with the options, so all of it can be shown at once
export function validatePromptOptions(options: PromptOptions): string[] {
  const errors: string[] = [];
  if (options.questionCount < 1 || options.questionCount > 50) {
    errors.push('Choose between 1 and 50 questions.');
  }
  if (options.types.length === 0) {
    errors.push('Select at least one question type.');
  }
  if (options.difficulty === 'custom') {
    const { easy, medium, hard } = options.mix;
    const total = easy + medium + hard;
    if (total !== 100) {
      errors.push(`The difficulty mix must add up to 100% (now ${total}%).`);
    }
  }
  return errors;
}

// Returns why the quiz cannot be started yet, or null when it is ready
export function validateTestConfig(config: TestConfig): string | null {
  if (config.timeLimitMinutes < 1 || config.timeLimitMinutes > 180) {
    return 'Time limit: 1 to 180 minutes';
  }
  return null;
}

// The requirements the student gave, one text per item
function requirements(options: PromptOptions): string[] {
  const types = options.types.map((type) => TYPE_RULES[type]).join('\n   - ');
  const items = [
    `Total Questions: ${options.questionCount} (exactly this many, no more and no fewer)`,
    difficultyRules(options).replace(/\n {2}/g, '\n   '),
  ];
  if (options.topics.trim()) {
    items.push(`Focus Topics: ${options.topics.trim()}`);
  }
  items.push(`Allowed Question Types:
   - ${types}

   [CRITICAL: YOU MUST STRICTLY GENERATE ONLY THE ALLOWED QUESTION TYPES LISTED ABOVE. IF ONLY ONE TYPE IS ALLOWED, ALL QUESTIONS MUST BE OF THAT EXACT TYPE. DO NOT MIX TYPES UNLESS EXPLICITLY LISTED.]`);
  if (options.notes.trim()) {
    items.push(`Special Instructions: ${options.notes.trim()}`);
  }
  return items;
}

// One check line for each requirement that was given
function requirementChecks(options: PromptOptions): string[] {
  const checks = [
    `□ There are exactly ${options.questionCount} questions`,
    `□ Every question has an allowed type: ${options.types.join(', ')}`,
    '□ The difficulty rules in the mandatory requirements are followed',
  ];
  if (options.topics.trim()) {
    checks.push('□ The questions cover the focus topics');
  }
  if (options.notes.trim()) {
    checks.push('□ Every special instruction is followed');
  }
  return checks;
}

// The id is passed in, so the same options always give the same text
export function buildPrompt(options: PromptOptions, id: string): string {
  const items = requirements(options)
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');
  const checks = requirementChecks(options).join('\n');

  return `You are an expert exam question creator. Generate a high-quality practice test from the study material provided at the end of this prompt.

═══ MANDATORY REQUIREMENTS ═══

Follow every numbered requirement exactly. They override every style rule below. Only the JSON output format further down cannot be overridden.

${items}

═══ CONTENT ANALYSIS RULES ═══

Before writing questions, mentally separate the study material into two categories:

- TEACHING CONTENT (build questions from this): concepts, definitions, mechanics, trade-offs, commands, code examples, diagrams, formulas, comparisons between approaches.
- COURSE ADMINISTRATION (never test this): lab instructions, deliverable checklists, exam dates, grading rubrics, integrity rules, module codes, submission deadlines.

Lab/assignment sections are still useful — they tell you which *operations* the student has performed, so you can set questions in realistic scenarios. But never ask "what did the lab instruct you to do" — ask about the *skill* the lab exercises.

Litmus test: if a question's correct answer would change when the lecturer edits the handout (without any underlying concept changing), it is testing logistics, not understanding. Rewrite or discard it.

═══ QUESTION QUALITY RULES ═══

SOURCE FIDELITY:
- Every question must be answerable from the provided study material.
- Do NOT invent content, tools, or concepts the material does not cover — a question about something not in the student's slides is wasted revision time.
- Code snippets in questions should reflect the language/tools used in the material.
- Unless the requirements name focus topics, extract the key topics from the study material and cover them proportionally.

DISTRACTOR QUALITY (for MCQ / multi-select / true-false):
- Every question must have at least one distractor (wrong option) that is wrong for a specific, learnable reason — not obviously wrong filler.
- Good distractors: true in a neighbouring context, satisfies most constraints but fails one, is the answer a confident-but-mistaken student would give.
- Bad distractors: obviously absurd, grammatically inconsistent with the stem, unrelated to the topic.

ANTI-PATTERNS (never do these):
- Pure recall with no application ("How many X are there?"), except for Easy questions, where direct recall is fine
- "All of the above" or "None of the above" as options
- Trick questions that depend on a missing/ambiguous word rather than understanding
- Options that reveal the answer through length, grammar, or shape (e.g., one option is much longer and more detailed than others)
- Stems with "always" or "never" as a reliable tell for wrong options

EXPLANATION QUALITY:
- Keep the "explanation" field concise and direct. Focus purely on the main reasoning for the correct answer. You do not need to analyze every wrong option unless it's highly relevant.
- Do not make the explanation overly verbose. Use that context budget to write better distractors instead.

OPTION RANDOMIZATION (CRITICAL):
- You MUST statistically randomize the correct answer across the quiz (e.g. sometimes 'a', sometimes 'c', 'd', 'b'), unless a mandatory requirement says where the correct answers go. If one does, obey it instead.
- Without such a requirement, DO NOT default to 'a' or 'b' for every question. Ensure a roughly even distribution of correct option letters throughout the provided questions.

═══ REQUIRED JSON OUTPUT ═══

Return ONLY valid JSON inside a \`\`\`json\`\`\` code block. No conversational text before or after.

\`\`\`json
{
  "id": "${id}",
  "title": "[COURSE CODE] — [EXAM TITLE]",
  "courseCode": "[COURSE CODE]",
  "description": "[Brief summary of topics covered]",
  "questions": [
    {
      "id": "q1",
      "number": 1,
      "type": "mcq",
      "difficulty": "medium",
      "prompt": "Clear, concise question stem. For scenario questions, include enough context to force a judgement.",
      "codeSnippet": null,
      "codeLanguage": null,
      "points": 1,
      "options": [
        { "id": "a", "text": "Option text" },
        { "id": "b", "text": "Option b text" },
        { "id": "c", "text": "Option c text" },
        { "id": "d", "text": "Option d text" }
      ],
      "correctAnswer": "a",
      "explanation": "One or two sentences on why the correct answer is right."
    }
  ]
}
\`\`\`

TYPE-SPECIFIC RULES:
- "mcq": exactly one correct answer (string). 3–5 options.
- "multi-select": multiple correct answers (array of IDs, e.g. ["a","c"]). 4–6 options. Do NOT hint at how many are correct in the prompt.
- "true-false": options must be exactly [{"id":"a","text":"True"},{"id":"b","text":"False"}].
- "short-answer": omit "options". "correctAnswer" is a string.
- "multi-blank": omit "options". The prompt MUST contain the exact string "[BLANK]" strategically where inputs go (e.g. "To compile Java, run [BLANK] and then [BLANK]"). "correctAnswer" MUST be an array of strings in order of the blanks.
- "codeSnippet" and "codeLanguage": include only when the question genuinely involves code, unless a requirement says to include them on every question. Set to null otherwise.
- "difficulty": must be "easy", "medium", or "hard" for every question.

═══ SELF-CHECK BEFORE OUTPUTTING ═══

Before returning, verify every mandatory requirement:
${checks}

Then verify the quality rules:
□ Every question is answerable from the provided material (no invented content)
□ Every MCQ/multi-select question has at least one strong distractor
□ Correct answer letters (a, b, c, d) are evenly randomized across the test, unless a requirement says where they go
□ No question can be answered by shape/length/grammar elimination alone
□ Explanations are concise and strictly focused on the correct reasoning
□ Difficulty tags match the calibration rules above
□ The JSON is valid and parseable

═══ STUDY MATERIAL BELOW ═══
`;
}
