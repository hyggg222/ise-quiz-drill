import type {
  AntiCheatOptions,
  QuestionType,
  TemplateMode,
} from '../types/quiz';
import type { SavedReviewQuestion } from '../types/review';

export type DifficultyMode = 'auto' | 'easy' | 'medium' | 'hard' | 'custom';

// Settings the app applies itself; none of them is sent to the AI
export interface TestConfig {
  // Optional: when empty the quiz keeps the title written in its JSON
  title: string;
  timeLimitMinutes: number;
  templateMode: TemplateMode;
  antiCheat: AntiCheatOptions;
}

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

// The id is passed in, so the same options always give the same text
export function buildPrompt(options: PromptOptions, id: string): string {
  const difficulty = difficultyRules(options);
  const types = options.types.map((type) => TYPE_RULES[type]).join('\n  - ');
  const topics = options.topics.trim()
    ? `Focus Topics: ${options.topics.trim()}`
    : 'Focus Topics: Extract key topics from the provided study material. Cover them proportionally.';
  const notes = options.notes.trim()
    ? `- Special Instructions: ${options.notes.trim()}\n`
    : '';

  return `You are an expert exam question creator. Generate a high-quality practice test from the study material provided at the end of this prompt.

═══ CONTENT ANALYSIS RULES ═══

Before writing questions, mentally separate the study material into two categories:

1. TEACHING CONTENT (build questions from this): concepts, definitions, mechanics, trade-offs, commands, code examples, diagrams, formulas, comparisons between approaches.
2. COURSE ADMINISTRATION (never test this): lab instructions, deliverable checklists, exam dates, grading rubrics, integrity rules, module codes, submission deadlines.

Lab/assignment sections are still useful — they tell you which *operations* the student has performed, so you can set questions in realistic scenarios. But never ask "what did the lab instruct you to do" — ask about the *skill* the lab exercises.

Litmus test: if a question's correct answer would change when the lecturer edits the handout (without any underlying concept changing), it is testing logistics, not understanding. Rewrite or discard it.

═══ EXAM PARAMETERS ═══

- Total Questions: ${options.questionCount}
- ${difficulty}
- ${topics}
- Allowed Question Types:
  - ${types}

  [CRITICAL: YOU MUST STRICTLY GENERATE ONLY THE ALLOWED QUESTION TYPES LISTED ABOVE. IF ONLY ONE TYPE IS ALLOWED, ALL QUESTIONS MUST BE OF THAT EXACT TYPE. DO NOT MIX TYPES UNLESS EXPLICITLY LISTED.]
${notes}

═══ QUESTION QUALITY RULES ═══

SOURCE FIDELITY:
- Every question must be answerable from the provided study material.
- Do NOT invent content, tools, or concepts the material does not cover — a question about something not in the student's slides is wasted revision time.
- Code snippets in questions should reflect the language/tools used in the material.

DISTRACTOR QUALITY (for MCQ / multi-select / true-false):
- Every question must have at least one distractor (wrong option) that is wrong for a specific, learnable reason — not obviously wrong filler.
- Good distractors: true in a neighbouring context, satisfies most constraints but fails one, is the answer a confident-but-mistaken student would give.
- Bad distractors: obviously absurd, grammatically inconsistent with the stem, unrelated to the topic.

ANTI-PATTERNS (never do these):
- Pure recall with no application ("How many X are there?")
- "All of the above" or "None of the above" as options
- Trick questions that depend on a missing/ambiguous word rather than understanding
- Options that reveal the answer through length, grammar, or shape (e.g., one option is much longer and more detailed than others)
- Stems with "always" or "never" as a reliable tell for wrong options

EXPLANATION QUALITY:
- Keep the "explanation" field concise and direct. Focus purely on the main reasoning for the correct answer. You do not need to analyze every wrong option unless it's highly relevant.
- Do not make the explanation overly verbose. Use that context budget to write better distractors instead.

OPTION RANDOMIZATION (CRITICAL):
- You MUST statistically randomize the correct answer across the quiz (e.g. sometimes 'a', sometimes 'c', 'd', 'b').
- DO NOT default to 'a' or 'b' for every question. Ensure a roughly even distribution of correct option letters throughout the provided questions.

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
- "codeSnippet" and "codeLanguage": include only when the question genuinely involves code. Set to null otherwise.
- "difficulty": must be "easy", "medium", or "hard" for every question.

═══ SELF-CHECK BEFORE OUTPUTTING ═══

Before returning, verify:
□ Every question is answerable from the provided material (no invented content)
□ Every MCQ/multi-select question has at least one strong distractor
□ Correct answer letters (a, b, c, d) are evenly randomized across the test
□ No question can be answered by shape/length/grammar elimination alone
□ Explanations are concise and strictly focused on the correct reasoning
□ Difficulty tags match the calibration rules above
□ The JSON is valid and parseable

═══ STUDY MATERIAL BELOW ═══
`;
}

export function buildReviewPrompt(
  options: PromptOptions,
  id: string,
  savedQuestions: SavedReviewQuestion[],
  reviewPercentage = 60,
): string {
  const prompt = buildPrompt(options, id);
  const savedQuestionDetails = savedQuestions.map((saved) => ({
    sourceQuiz: saved.quizTitle,
    courseCode: saved.courseCode,
    question: saved.question.prompt,
    options:
      saved.question.options?.map((option) => ({
        id: option.id,
        text: option.text,
      })) ?? [],
    correctAnswer: saved.question.correctAnswer,
    explanation: saved.question.explanation ?? '',
    studentWrongAnswer: saved.wrongAnswer,
  }));
  const instructions = `═══ TARGETED REVIEW TEST ═══

- Make approximately ${reviewPercentage}% of the questions test the concepts and skills represented by the saved mistakes below.
- Make approximately ${100 - reviewPercentage}% new questions on the same topics, grounded in the study material that follows.
- Treat the saved questions as private study references only. Do NOT copy or closely paraphrase their stems, scenarios, options, or explanations. Write fresh questions that test the same underlying learning objectives.
- Use the wrong answers to identify likely misunderstandings, then create useful practice that addresses them.
- Keep all normal question-quality, source-fidelity, option, explanation, and JSON rules above.

Saved mistakes (reference only; never reproduce verbatim):
${JSON.stringify(savedQuestionDetails, null, 2)}

`;

  return prompt.replace(
    '═══ STUDY MATERIAL BELOW ═══',
    `${instructions}═══ STUDY MATERIAL BELOW ═══`,
  );
}
