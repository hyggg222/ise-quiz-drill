import { describe, it, expect } from 'vitest';
import {
  buildReviewPrompt,
  buildPrompt,
  defaultPromptOptions,
  defaultTestConfig,
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
    expect(prompt).toContain('- Total Questions: 12');
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

describe('buildReviewPrompt', () => {
  it('includes saved mistakes and asks for a non-copying 60/40 practice mix', () => {
    const prompt = buildReviewPrompt(options(), 'review-test', [
      {
        id: 'quiz:q1',
        quizId: 'quiz',
        quizTitle: 'Cloud basics',
        courseCode: 'CS1',
        question: {
          id: 'q1',
          number: 1,
          page: 1,
          type: 'mcq',
          prompt: 'What is object storage?',
          points: 1,
          options: [{ id: 'a', text: 'Stores objects' }],
          correctAnswer: 'a',
        },
        wrongAnswer: 'b',
        timesWrong: 2,
      },
    ]);

    expect(prompt).toContain('approximately 60%');
    expect(prompt).toContain('approximately 40%');
    expect(prompt).toContain('What is object storage?');
    expect(prompt).toContain('Do NOT copy or closely paraphrase');
    expect(prompt).toContain('═══ STUDY MATERIAL BELOW ═══');
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
