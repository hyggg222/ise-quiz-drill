// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsReview } from './ResultsReview';
import type { Question, QuizConfig, QuizEvent } from '../../types/quiz';

const question = (number: number, points = 1): Question => ({
  id: `q${number}`,
  number,
  page: 1,
  type: 'mcq',
  points,
  prompt: `Prompt ${number}`,
  options: [
    { id: 'a', text: 'Right' },
    { id: 'b', text: 'Wrong' },
  ],
  correctAnswer: 'a',
});

const quiz: QuizConfig = {
  id: 'quiz',
  title: 'DevOps Midterm',
  courseCode: 'CS4421',
  description: '',
  templateMode: 'paginated',
  timeLimitMinutes: 15,
  questionsPerPage: 1,
  questions: [question(1, 2), question(2), question(3, 2)],
};

const events: QuizEvent[] = [
  {
    type: 'focus_lost',
    timestamp: '2026-10-12T09:15:00.000Z',
    details: 'Left the quiz tab',
  },
];

const renderResults = (
  answers: Record<string, string> = { q1: 'a', q2: 'b' },
  overrides: Partial<Parameters<typeof ResultsReview>[0]> = {},
) =>
  render(
    <ResultsReview
      quiz={quiz}
      answers={answers}
      timeTakenSeconds={754}
      onRetake={() => {}}
      {...overrides}
    />,
  );

describe('ResultsReview', () => {
  it('summarises the score and time taken', () => {
    renderResults();
    const summary = screen.getByRole('region', {
      name: 'Quiz Submission Overview',
    });

    expect(summary).toHaveTextContent('2 / 5 (40%)');
    expect(summary).toHaveTextContent('12m 34s');
    expect(summary).toHaveTextContent('Submitted');
  });

  it('shows only incorrect questions at first, with counts on each filter', () => {
    renderResults();

    expect(
      screen.getByRole('button', { name: 'Incorrect Only 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Correct 1' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All 3' })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('heading', { name: /^Question \d$/ })
        .map((h) => h.textContent),
    ).toEqual(['Question 2', 'Question 3']);
  });

  it('switches the filter', async () => {
    renderResults();

    await userEvent.click(screen.getByRole('button', { name: 'All 3' }));

    expect(
      screen.getAllByRole('heading', { name: /^Question \d$/ }),
    ).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('congratulates a perfect attempt', () => {
    renderResults({ q1: 'a', q2: 'a', q3: 'a' });
    expect(
      screen.getByText('Perfect Score! No incorrect questions.'),
    ).toBeInTheDocument();
  });

  it('lists proctoring events when anti-cheat is on', () => {
    renderResults(undefined, {
      quiz: {
        ...quiz,
        antiCheat: {
          enabled: true,
          tabLock: true,
          uiRestrictions: false,
          fullscreenLock: false,
        },
      },
      eventLog: events,
    });
    const log = screen.getByRole('region', { name: 'Proctoring Audit Trail' });

    expect(log).toHaveTextContent('focus lost');
    expect(log).toHaveTextContent('Left the quiz tab');
    expect(log.querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-10-12T09:15:00.000Z',
    );
  });

  it('hides the proctoring log when anti-cheat is off', () => {
    renderResults(undefined, { eventLog: events });
    expect(
      screen.queryByRole('region', { name: 'Proctoring Audit Trail' }),
    ).not.toBeInTheDocument();
  });

  it('offers a retake', async () => {
    const onRetake = vi.fn();
    renderResults(undefined, { onRetake });

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Retake Quiz' })[0],
    );

    expect(onRetake).toHaveBeenCalledOnce();
    expect(onRetake).toHaveBeenCalledWith(false);
  });

  it('passes the shuffle choice to the retake handler', async () => {
    const onRetake = vi.fn();
    renderResults(undefined, { onRetake });

    await userEvent.click(screen.getAllByLabelText('Shuffle answers')[0]);
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Retake Quiz' })[0],
    );

    expect(onRetake).toHaveBeenCalledWith(true);
  });
});
