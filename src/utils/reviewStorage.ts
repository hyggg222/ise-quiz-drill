import type { Question } from '../types/quiz';
import type { SavedReviewQuestion } from '../types/review';
import type { Answer } from './answers';
import type { KeyValueStore } from './browserStorage';

export const REVIEW_QUESTIONS_KEY = 'quiz-drill:v1:review-questions';

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false;
  const question = value as Partial<Question>;
  return (
    typeof question.id === 'string' &&
    typeof question.number === 'number' &&
    typeof question.prompt === 'string' &&
    typeof question.type === 'string' &&
    typeof question.points === 'number' &&
    (typeof question.correctAnswer === 'string' ||
      Array.isArray(question.correctAnswer))
  );
}

function isAnswer(value: unknown): value is Answer {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((part) => typeof part === 'string'))
  );
}

function isSavedReviewQuestion(value: unknown): value is SavedReviewQuestion {
  if (!value || typeof value !== 'object') return false;
  const saved = value as Partial<SavedReviewQuestion>;
  return (
    typeof saved.id === 'string' &&
    typeof saved.quizId === 'string' &&
    typeof saved.quizTitle === 'string' &&
    typeof saved.courseCode === 'string' &&
    isQuestion(saved.question) &&
    isAnswer(saved.wrongAnswer) &&
    typeof saved.timesWrong === 'number' &&
    Number.isInteger(saved.timesWrong) &&
    saved.timesWrong > 0
  );
}

export function loadReviewQuestions(
  storage: KeyValueStore,
): SavedReviewQuestion[] {
  try {
    const raw = storage.getItem(REVIEW_QUESTIONS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedReviewQuestion) : [];
  } catch {
    return [];
  }
}

export function saveWrongQuestion(
  storage: KeyValueStore,
  entry: Omit<SavedReviewQuestion, 'id' | 'timesWrong'>,
): SavedReviewQuestion {
  const id = `${entry.quizId}:${entry.question.id}`;
  const current = loadReviewQuestions(storage);
  const existing = current.find((saved) => saved.id === id);
  const saved: SavedReviewQuestion = {
    ...entry,
    id,
    timesWrong: (existing?.timesWrong ?? 0) + 1,
  };
  storage.setItem(
    REVIEW_QUESTIONS_KEY,
    JSON.stringify([saved, ...current.filter((item) => item.id !== id)]),
  );
  return saved;
}

export function deleteReviewQuestion(storage: KeyValueStore, id: string): void {
  storage.setItem(
    REVIEW_QUESTIONS_KEY,
    JSON.stringify(
      loadReviewQuestions(storage).filter((item) => item.id !== id),
    ),
  );
}
