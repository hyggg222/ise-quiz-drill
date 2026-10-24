import { describe, it, expect } from 'vitest';
import { checkImport } from './importCheck';
import {
  defaultPromptOptions,
  easyToHardText,
  type PromptOptions,
} from './promptBuilder';
import type { Question } from '../types/quiz';

const options = (overrides: Partial<PromptOptions> = {}): PromptOptions => ({
  ...defaultPromptOptions,
  questionCount: 3,
  types: ['mcq'],
  ...overrides,
});

// The order is asked for by the chip text in the notes
const ordered: Partial<PromptOptions> = { notes: easyToHardText };

// Only type and difficulty matter to the check
const quiz = (...parts: [Question['type'], Question['difficulty']?][]) => ({
  questions: parts.map(
    ([type, difficulty], index) =>
      ({ number: 90 + index, type, difficulty }) as Question,
  ),
});

describe('checkImport', () => {
  it('has no warning when the quiz matches the options', () => {
    const q = quiz(['mcq', 'easy'], ['mcq', 'medium'], ['mcq', 'hard']);
    expect(checkImport(options(ordered), q)).toEqual([]);
  });

  it('warns once when the question count differs', () => {
    const q = quiz(['mcq'], ['mcq']);
    expect(checkImport(options(), q)).toEqual([
      'Asked for 3 questions, got 2.',
    ]);
  });

  it('lists the questions of a type that was not allowed by list position', () => {
    const q = quiz(['mcq'], ['true-false'], ['short-answer']);
    expect(checkImport(options(), q)).toEqual([
      'Type not allowed: question 2 (true-false), question 3 (short-answer).',
    ]);
  });

  it('lists the questions easier than the closest earlier one', () => {
    const q = quiz(['mcq', 'hard'], ['mcq', 'medium'], ['mcq', 'easy']);
    expect(checkImport(options(ordered), q)).toEqual([
      'Not in easy-to-hard order: questions 2, 3.',
    ]);
  });

  it('compares with the closest earlier question that has a difficulty', () => {
    const q = quiz(['mcq', 'hard'], ['mcq'], ['mcq', 'medium']);
    expect(checkImport(options(ordered), q)).toEqual([
      'Not in easy-to-hard order: question 3.',
      'No difficulty on question 2, so its order cannot be checked.',
    ]);
  });

  it('lists the questions with no difficulty when the order was asked for', () => {
    const q = quiz(['mcq'], ['mcq', 'easy'], ['mcq']);
    expect(checkImport(options(ordered), q)).toEqual([
      'No difficulty on questions 1, 3, so their order cannot be checked.',
    ]);
  });

  it('skips the order and difficulty checks when the order was not asked for', () => {
    const q = quiz(['mcq', 'hard'], ['mcq', 'easy'], ['mcq']);
    expect(checkImport(options(), q)).toEqual([]);
  });

  it('checks count and types even when the order was not asked for', () => {
    const q = quiz(['true-false']);
    expect(checkImport(options({ notes: 'British spelling' }), q)).toEqual([
      'Asked for 3 questions, got 1.',
      'Type not allowed: question 1 (true-false).',
    ]);
  });

  it('finds the order request among other notes', () => {
    const q = quiz(['mcq', 'hard'], ['mcq', 'easy'], ['mcq', 'medium']);
    const notes = `British spelling\n${easyToHardText}`;
    expect(checkImport(options({ notes }), q)).toEqual([
      'Not in easy-to-hard order: question 2.',
    ]);
  });

  it('judges a question by the one right before it, not the highest so far', () => {
    const q = quiz(['mcq', 'hard'], ['mcq', 'easy'], ['mcq', 'medium']);
    expect(checkImport(options(ordered), q)).toEqual([
      'Not in easy-to-hard order: question 2.',
    ]);
  });

  it('reports every kind together, in order', () => {
    const q = quiz(
      ['mcq', 'hard'],
      ['true-false', 'easy'],
      ['mcq'],
      ['mcq', 'easy'],
    );
    expect(checkImport(options(ordered), q)).toEqual([
      'Asked for 3 questions, got 4.',
      'Type not allowed: question 2 (true-false).',
      'Not in easy-to-hard order: question 2.',
      'No difficulty on question 3, so its order cannot be checked.',
    ]);
  });
});
