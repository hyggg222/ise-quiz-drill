import { describe, expect, it } from 'vitest';
import { sampleQuiz } from '../data/sampleQuiz';
import { gradeQuiz } from './grading';
import { shuffleQuizAnswers } from './shuffleAnswers';

describe('shuffleQuizAnswers', () => {
  it('shuffles choice options without changing the correct answer or grading', () => {
    const original = sampleQuiz.questions[0];
    const quiz = {
      ...sampleQuiz,
      questions: [original],
    };
    const shuffled = shuffleQuizAnswers(quiz, () => 0);

    expect(shuffled.questions[0].options?.map((option) => option.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(shuffled.questions[0].correctAnswer).toBe(original.correctAnswer);
    expect(
      gradeQuiz(shuffled, { [original.id]: original.correctAnswer }),
    ).toMatchObject({ earnedScore: original.points, percentage: 100 });
    expect(original.options?.map((option) => option.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('keeps true/false options in their canonical order', () => {
    const question = sampleQuiz.questions.find(
      (item) => item.type === 'true-false',
    )!;
    const shuffled = shuffleQuizAnswers(
      { ...sampleQuiz, questions: [question] },
      () => 0,
    );

    expect(shuffled.questions[0].options).toEqual(question.options);
  });

  it('restores True before False if a true/false source is reversed', () => {
    const question = sampleQuiz.questions.find(
      (item) => item.type === 'true-false',
    )!;
    const reversed = {
      ...question,
      options: [...question.options!].reverse(),
    };
    const shuffled = shuffleQuizAnswers(
      { ...sampleQuiz, questions: [reversed] },
      () => 0,
    );

    expect(shuffled.questions[0].options?.map((option) => option.text)).toEqual(
      ['True', 'False'],
    );
    expect(shuffled.questions[0].correctAnswer).toBe(question.correctAnswer);
  });

  it('keeps the same order when randomization returns the original permutation', () => {
    const quiz = { ...sampleQuiz, questions: [sampleQuiz.questions[0]] };
    const shuffled = shuffleQuizAnswers(quiz, () => 0.99);

    expect(
      shuffled.questions[0].options?.map((option) => option.id),
    ).not.toEqual(quiz.questions[0].options?.map((option) => option.id));
  });
});
