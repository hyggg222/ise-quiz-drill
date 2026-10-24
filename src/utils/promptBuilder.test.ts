import { describe, it, expect } from 'vitest';
import {
  buildPrompt,
  defaultPromptOptions,
  defaultTestConfig,
  easyToHardText,
  validatePromptOptions,
  validateTestConfig,
  type PromptOptions,
  type TestConfig,
} from './promptBuilder';

// The defaults are empty; most tests want options that can build a prompt
const options = (overrides: Partial<PromptOptions> = {}): PromptOptions => ({
  ...defaultPromptOptions,
  questionCount: 10,
  types: ['mcq', 'multi-select', 'true-false', 'short-answer'],
  ...overrides,
});

const config = (overrides: Partial<TestConfig> = {}): TestConfig => ({
  ...defaultTestConfig,
  title: 'Midterm',
  ...overrides,
});

describe('buildPrompt', () => {
  it('leaves the title to the app and keeps only a placeholder for the AI', () => {
    const prompt = buildPrompt(options(), 'quiz-1');
    expect(prompt).not.toContain('Exam Title');
    expect(prompt).toContain('"title": "[COURSE CODE] — [EXAM TITLE]"');
  });

  it('does not mention settings that the app applies itself', () => {
    const prompt = buildPrompt(options(), 'quiz-1');
    expect(prompt).not.toMatch(/time limit|anti-cheat|proctor|fullscreen/i);
  });

  it('asks for the chosen number of questions and only the chosen types', () => {
    const prompt = buildPrompt(
      options({ questionCount: 12, types: ['mcq', 'multi-blank'] }),
      'quiz-1',
    );
    expect(prompt).toContain('1. Total Questions: 12');
    expect(prompt).toContain('"mcq" (single correct answer)');
    expect(prompt).toContain('"multi-blank"');
    expect(prompt).not.toContain('"true-false" (True / False only)');
  });

  it('spells out a custom difficulty mix', () => {
    const prompt = buildPrompt(
      options({
        difficulty: 'custom',
        mix: { easy: 20, medium: 50, hard: 30 },
      }),
      'quiz-1',
    );
    expect(prompt).toContain('20% Easy, 50% Medium, 30% Hard');
  });

  it('includes topics and notes only when given', () => {
    const withExtras = buildPrompt(
      options({ topics: 'IaC, CDK', notes: 'British spelling' }),
      'quiz-1',
    );
    expect(withExtras).toContain('Focus Topics: IaC, CDK');
    expect(withExtras).toContain('Special Instructions: British spelling');
    expect(buildPrompt(options(), 'quiz-1')).not.toContain(
      'Special Instructions',
    );
  });

  it('gives the same text for the same options and id', () => {
    expect(buildPrompt(options(), 'quiz-1')).toBe(
      buildPrompt(options(), 'quiz-1'),
    );
    expect(buildPrompt(options(), 'quiz-1')).toContain('"id": "quiz-1"');
  });
});

// The part of the prompt between two section titles
const section = (prompt: string, from: string, to: string): string =>
  prompt.slice(prompt.indexOf(from), prompt.indexOf(to));

describe('buildPrompt requirements block', () => {
  const full = options({
    questionCount: 12,
    types: ['mcq', 'multi-blank'],
    topics: 'IaC, CDK',
    notes: 'British spelling',
  });

  it('puts every requirement before every other section', () => {
    const prompt = buildPrompt(full, 'quiz-1');
    const style = prompt.indexOf('CONTENT ANALYSIS RULES');
    for (const text of [
      'Total Questions: 12',
      'Focus Topics: IaC, CDK',
      '"multi-blank"',
      'ONLY THE ALLOWED QUESTION TYPES',
      'Special Instructions: British spelling',
    ]) {
      expect(prompt.indexOf(text)).toBeGreaterThan(-1);
      expect(prompt.indexOf(text)).toBeLessThan(style);
    }
  });

  it('opens with the role sentence and then the requirements', () => {
    const prompt = buildPrompt(full, 'quiz-1');
    expect(prompt.startsWith('You are an expert exam question creator.')).toBe(
      true,
    );
    expect(prompt.indexOf('MANDATORY REQUIREMENTS')).toBeLessThan(
      prompt.indexOf('CONTENT ANALYSIS RULES'),
    );
  });

  it('numbers the requirements', () => {
    const block = section(
      buildPrompt(full, 'quiz-1'),
      'MANDATORY REQUIREMENTS',
      'CONTENT ANALYSIS RULES',
    );
    expect(block).toMatch(/^1\. Total Questions: 12/m);
    expect(block).toMatch(/^2\. /m);
    expect(block).toMatch(/^5\. Special Instructions: British spelling/m);
  });

  it('says the requirements beat the style rules but not the JSON format', () => {
    const block = section(
      buildPrompt(full, 'quiz-1'),
      'MANDATORY REQUIREMENTS',
      'CONTENT ANALYSIS RULES',
    );
    expect(block).toMatch(/override/i);
    expect(block).toMatch(/JSON/);
  });

  it('leaves out empty topics and special instructions', () => {
    const block = section(
      buildPrompt(options(), 'quiz-1'),
      'MANDATORY REQUIREMENTS',
      'CONTENT ANALYSIS RULES',
    );
    expect(block).not.toContain('Focus Topics');
    expect(block).not.toContain('Special Instructions');
    expect(block).toMatch(/^3\. Allowed Question Types/m);
  });

  it('covers the key topics in the quality rules when none are named', () => {
    const fidelity = (prompt: string) =>
      section(prompt, 'SOURCE FIDELITY', 'DISTRACTOR QUALITY');
    const empty = buildPrompt(options(), 'quiz-1');
    expect(fidelity(empty)).toMatch(
      /unless the requirements name focus topics[^\n]*key topics[^\n]*proportionally/i,
    );
    expect(empty).not.toContain('Focus Topics');
    const named = buildPrompt(options({ topics: 'IaC' }), 'quiz-1');
    expect(named).toContain('Focus Topics: IaC');
  });

  it('does not repeat the requirements further down', () => {
    const prompt = buildPrompt(full, 'quiz-1');
    expect(prompt).not.toContain('EXAM PARAMETERS');
    expect(prompt.split('British spelling')).toHaveLength(2);
    expect(prompt.split('Total Questions: 12')).toHaveLength(2);
  });

  it('keeps the JSON output format section', () => {
    const prompt = buildPrompt(full, 'quiz-1');
    expect(prompt).toContain('REQUIRED JSON OUTPUT');
    expect(prompt).toContain('"id": "quiz-1"');
    expect(prompt).toContain('TYPE-SPECIFIC RULES');
  });
});

describe('easy to hard instruction', () => {
  it('asks for the order only when there is more than one difficulty', () => {
    expect(easyToHardText).toMatch(/more than one difficulty/i);
    expect(easyToHardText).toMatch(/easiest to hardest/);
  });

  it('reaches the prompt through the special instructions', () => {
    const prompt = buildPrompt(options({ notes: easyToHardText }), 'quiz-1');

    expect(prompt).toContain(`Special Instructions: ${easyToHardText}`);
  });

  it('is not in a prompt that was not asked for it', () => {
    expect(buildPrompt(options(), 'quiz-1')).not.toContain(
      'easiest to hardest',
    );
  });
});

describe('buildPrompt self-check', () => {
  const check = (prompt: string) =>
    section(prompt, 'SELF-CHECK BEFORE OUTPUTTING', 'STUDY MATERIAL BELOW');

  it('lists each requirement that was given', () => {
    const list = check(
      buildPrompt(
        options({
          questionCount: 12,
          types: ['mcq', 'multi-blank'],
          difficulty: 'hard',
          topics: 'IaC',
          notes: 'British spelling',
        }),
        'quiz-1',
      ),
    );
    expect(list).toContain('exactly 12 questions');
    expect(list).toContain('allowed type: mcq, multi-blank');
    expect(list).toMatch(/difficulty/i);
    expect(list).toContain('focus topics');
    expect(list).toContain('special instruction');
  });

  it('leaves out the requirements that were not given', () => {
    const list = check(buildPrompt(options(), 'quiz-1'));
    expect(list).not.toContain('focus topics');
    expect(list).not.toContain('special instruction');
  });

  it('keeps the existing quality checks', () => {
    const list = check(buildPrompt(options(), 'quiz-1'));
    expect(list).toContain('answerable from the provided material');
    expect(list).toContain('The JSON is valid and parseable');
  });
});

describe('buildPrompt rules that agree with the requirements', () => {
  const prompt = buildPrompt(options(), 'quiz-1');

  it('allows direct recall for Easy questions', () => {
    const rule = section(prompt, 'ANTI-PATTERNS', 'EXPLANATION QUALITY');
    expect(rule).toMatch(/Pure recall[^\n]*Easy/);
  });

  it('lets a requirement about answer positions beat the random spread', () => {
    const rule = section(
      prompt,
      'OPTION RANDOMIZATION',
      'REQUIRED JSON OUTPUT',
    );
    expect(rule).toMatch(
      /randomi[sz]e[^\n]*unless a mandatory requirement says where the correct answers go/i,
    );
  });

  it('writes the option rule as sentences, with no bullet that only opens another', () => {
    const rule = section(
      prompt,
      'OPTION RANDOMIZATION',
      'REQUIRED JSON OUTPUT',
    );
    expect(rule).not.toMatch(/^- .*:$/m);
  });

  it('lets a requirement beat the code-snippet rule, and says which wins', () => {
    const rules = section(
      buildPrompt(
        options({
          notes: 'Set codeSnippet and codeLanguage on every question',
        }),
        'quiz-1',
      ),
      'TYPE-SPECIFIC RULES',
      'SELF-CHECK BEFORE OUTPUTTING',
    );
    expect(rules).toMatch(
      /"codeSnippet" and "codeLanguage": include only when the question genuinely involves code, unless a requirement says to include them on every question/,
    );
  });

  it('numbers nothing but the requirements', () => {
    const before = (text: string) =>
      text.slice(0, text.indexOf('REQUIRED JSON OUTPUT'));
    const numbered = (text: string) => text.match(/^[ \t]*\d+\. .*$/gm) ?? [];
    const prompt = buildPrompt(
      options({
        topics: 'IaC',
        notes: 'British spelling',
      }),
      'quiz-1',
    );
    const block = section(
      prompt,
      'MANDATORY REQUIREMENTS',
      'CONTENT ANALYSIS RULES',
    );
    expect(numbered(block).length).toBeGreaterThan(0);
    expect(numbered(before(prompt))).toEqual(numbered(block));
  });
});

describe('validatePromptOptions', () => {
  it('accepts options with a count and a question type', () => {
    expect(validatePromptOptions(options())).toEqual([]);
  });

  it('starts with only the difficulty chosen: auto', () => {
    expect(defaultPromptOptions).toMatchObject({
      questionCount: 0,
      difficulty: 'auto',
      topics: '',
      types: [],
      notes: '',
    });
  });

  it('lists everything still missing from the defaults', () => {
    expect(validatePromptOptions(defaultPromptOptions)).toEqual([
      'Choose between 1 and 50 questions.',
      'Select at least one question type.',
    ]);
  });

  it('needs at least one question type', () => {
    expect(validatePromptOptions(options({ types: [] }))).toEqual([
      'Select at least one question type.',
    ]);
  });

  it('needs a custom difficulty mix that adds up to 100%', () => {
    expect(
      validatePromptOptions(
        options({
          difficulty: 'custom',
          mix: { easy: 30, medium: 30, hard: 30 },
        }),
      ),
    ).toEqual(['The difficulty mix must add up to 100% (now 90%).']);
    expect(
      validatePromptOptions(
        options({ difficulty: 'easy', mix: { easy: 0, medium: 0, hard: 0 } }),
      ),
    ).toEqual([]);
  });

  it('needs a question count between 1 and 50', () => {
    for (const questionCount of [0, 51]) {
      expect(validatePromptOptions(options({ questionCount }))).toEqual([
        'Choose between 1 and 50 questions.',
      ]);
    }
  });
});

describe('validateTestConfig', () => {
  it('accepts the default settings', () => {
    expect(validateTestConfig(config())).toBeNull();
  });

  it('does not need a title, the quiz JSON has one', () => {
    expect(validateTestConfig(config({ title: '' }))).toBeNull();
    expect(validateTestConfig(config({ title: '   ' }))).toBeNull();
  });

  it('needs a time limit between 1 and 180 minutes', () => {
    expect(validateTestConfig(config({ timeLimitMinutes: 0 }))).toBe(
      'Time limit: 1 to 180 minutes',
    );
    expect(validateTestConfig(config({ timeLimitMinutes: 181 }))).toBe(
      'Time limit: 1 to 180 minutes',
    );
  });
});
