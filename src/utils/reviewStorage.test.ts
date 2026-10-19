import { describe, expect, it } from 'vitest';
import type { Question } from '../types/quiz';
import {
  REVIEW_QUESTIONS_KEY,
  loadReviewQuestions,
  saveWrongQuestion,
} from './reviewStorage';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const question: Question = {
  id: 'q1',
  number: 1,
  page: 1,
  type: 'mcq',
  prompt: 'Question?',
  points: 1,
  options: [
    { id: 'a', text: 'Right' },
    { id: 'b', text: 'Wrong' },
  ],
  correctAnswer: 'a',
  explanation: 'Because it is right.',
};

describe('review question storage', () => {
  it('persists a missed question and increments its miss count on duplicates', () => {
    const storage = new MemoryStorage();
    const entry = {
      quizId: 'quiz1',
      quizTitle: 'Quiz title',
      courseCode: 'CS1',
      question,
      wrongAnswer: 'b',
    };

    saveWrongQuestion(storage, entry);
    saveWrongQuestion(storage, { ...entry, wrongAnswer: '' });

    expect(loadReviewQuestions(storage)).toEqual([
      {
        ...entry,
        wrongAnswer: '',
        id: 'quiz1:q1',
        timesWrong: 2,
      },
    ]);
    expect(storage.getItem(REVIEW_QUESTIONS_KEY)).toBeTruthy();
  });

  it('skips corrupt list entries while loading', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      REVIEW_QUESTIONS_KEY,
      JSON.stringify([{ id: 'broken' }, null]),
    );

    expect(loadReviewQuestions(storage)).toEqual([]);
  });
});
