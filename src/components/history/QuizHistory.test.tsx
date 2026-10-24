// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuizHistory } from './QuizHistory';
import {
  appendHistory,
  loadHistory,
  loadSavedQuizzes,
  saveQuiz,
} from '../../utils/attemptStorage';
import { sampleQuiz } from '../../data/sampleQuiz';
import type { QuizAttemptRecord } from '../../types/quiz';

const record: QuizAttemptRecord = {
  id: 'attempt-1',
  quizId: sampleQuiz.id,
  quizTitle: sampleQuiz.title,
  courseCode: sampleQuiz.courseCode,
  timestamp: '2026-10-12T09:30:00.000Z',
  earnedScore: 3,
  totalPoints: 7,
  percentage: 42.86,
  timeTakenSeconds: 300,
  eventLog: [],
  answers: { 'demo-mcq': 'b' },
  quizSnapshot: sampleQuiz,
};

const handlers = () => ({
  onStart: vi.fn(),
  onCreate: vi.fn(),
  onReview: vi.fn(),
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('QuizHistory', () => {
  it('invites the student to create a first test when nothing is saved', async () => {
    const h = handlers();
    render(<QuizHistory {...h} />);

    expect(screen.getByText('No Saved Quizzes Found')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Create Your First Test' }),
    );

    expect(h.onCreate).toHaveBeenCalledOnce();
  });

  it('switches between the two tabs with the mouse and the arrow keys', async () => {
    saveQuiz(localStorage, sampleQuiz);
    appendHistory(localStorage, record);
    render(<QuizHistory {...handlers()} />);

    const saved = screen.getByRole('tab', { name: 'Saved Tests (1)' });
    const attempts = screen.getByRole('tab', { name: 'Attempt History (1)' });
    expect(saved).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(attempts);
    expect(attempts).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(
      'Attempt History (1)',
    );

    await userEvent.keyboard('{ArrowLeft}');
    expect(saved).toHaveAttribute('aria-selected', 'true');
    expect(saved).toHaveFocus();
  });

  it('lists saved tests and starts one', async () => {
    saveQuiz(localStorage, sampleQuiz);
    const h = handlers();
    render(<QuizHistory {...h} />);
    const card = screen.getByRole('article', {
      name: 'DevOps Basics Practice',
    });

    expect(card).toHaveTextContent('5 Questions');
    expect(card).toHaveTextContent('15 Minutes');
    await userEvent.click(
      within(card).getByRole('button', { name: 'Start Quiz' }),
    );

    expect(h.onStart).toHaveBeenCalledWith(sampleQuiz);
  });

  it('deletes a saved test only after confirming', async () => {
    saveQuiz(localStorage, sampleQuiz);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    render(<QuizHistory {...handlers()} />);
    const remove = screen.getByRole('button', {
      name: 'Delete DevOps Basics Practice',
    });

    await userEvent.click(remove);
    expect(loadSavedQuizzes(localStorage)).toHaveLength(1);

    confirm.mockReturnValueOnce(true);
    await userEvent.click(remove);
    expect(loadSavedQuizzes(localStorage)).toHaveLength(0);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('exports a saved test as a JSON file', async () => {
    saveQuiz(localStorage, sampleQuiz);
    URL.createObjectURL = vi.fn(() => 'blob:quiz');
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('devops_basics_practice.json');
      });
    render(<QuizHistory {...handlers()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(click).toHaveBeenCalledOnce();
  });

  it('shows past attempts with score, time and date', async () => {
    appendHistory(localStorage, record);
    const h = handlers();
    render(<QuizHistory {...h} />);
    await userEvent.click(screen.getByRole('tab', { name: /Attempt History/ }));

    const row = screen.getAllByRole('listitem')[0];
    expect(row).toHaveTextContent('DevOps Basics Practice');
    expect(row).toHaveTextContent('3/7');
    expect(row).toHaveTextContent('43%');
    expect(row).toHaveTextContent('5m 0s');
    expect(row.querySelector('time')).toHaveAttribute(
      'datetime',
      record.timestamp,
    );

    await userEvent.click(within(row).getByRole('button', { name: 'Review' }));
    expect(h.onReview).toHaveBeenCalledWith(record);
  });

  it('deletes one attempt only after confirming', async () => {
    appendHistory(localStorage, record);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<QuizHistory {...handlers()} />);
    await userEvent.click(screen.getByRole('tab', { name: /Attempt History/ }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete attempt' }),
    );
    expect(loadHistory(localStorage)).toHaveLength(1);

    confirm.mockReturnValue(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete attempt' }),
    );
    expect(loadHistory(localStorage)).toEqual([]);
  });

  it('clears the attempt history after confirming', async () => {
    appendHistory(localStorage, record);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<QuizHistory {...handlers()} />);
    await userEvent.click(screen.getByRole('tab', { name: /Attempt History/ }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear Attempt History' }),
    );

    expect(loadHistory(localStorage)).toEqual([]);
    expect(screen.getByText('No Attempt History Recorded')).toBeInTheDocument();
  });
});

// Data written by an earlier version of the app. Keys and shape are
// typed out here on purpose: they must never change.
describe('QuizHistory with data saved by an earlier version', () => {
  const builtIn = {
    id: 'ready-devops',
    title: 'DevOps Quiz',
    courseCode: 'CS4421',
    description: 'Practice test',
    templateMode: 'paginated',
    timeLimitMinutes: 15,
    questionsPerPage: 5,
    antiCheat: {
      enabled: true,
      tabLock: true,
      uiRestrictions: true,
      fullscreenLock: true,
    },
    questions: [
      {
        id: 'q1',
        number: 1,
        page: 1,
        type: 'mcq',
        points: 1,
        prompt: 'Pick one',
        options: [
          { id: 'a', text: 'One' },
          { id: 'b', text: 'Two' },
        ],
        correctAnswer: 'a',
      },
    ],
  };
  const attempt = {
    id: 'attempt-old',
    quizId: 'ready-devops',
    quizTitle: 'DevOps Quiz',
    courseCode: 'CS4421',
    timestamp: '2026-10-12T09:30:00.000Z',
    earnedScore: 1,
    totalPoints: 1,
    percentage: 100,
    timeTakenSeconds: 60,
    eventLog: [],
    answers: { q1: 'a' },
    quizSnapshot: builtIn,
  };

  it('still lists a saved test with an old id and starts it', async () => {
    localStorage.setItem('quiz-drill:v1:quizzes', JSON.stringify([builtIn]));
    const h = handlers();
    render(<QuizHistory {...h} />);

    const card = screen.getByRole('article', { name: 'DevOps Quiz' });
    await userEvent.click(
      within(card).getByRole('button', { name: 'Start Quiz' }),
    );

    expect(h.onStart).toHaveBeenCalledWith(builtIn);
  });

  it('still shows its attempts and opens the review', async () => {
    localStorage.setItem('quiz-drill:v1:history', JSON.stringify([attempt]));
    const h = handlers();
    render(<QuizHistory {...h} />);
    await userEvent.click(screen.getByRole('tab', { name: /Attempt History/ }));

    const row = screen.getAllByRole('listitem')[0];
    expect(row).toHaveTextContent('DevOps Quiz');
    await userEvent.click(within(row).getByRole('button', { name: 'Review' }));

    expect(h.onReview).toHaveBeenCalledWith(attempt);
  });
});
