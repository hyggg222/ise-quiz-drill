// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JsonImporter } from './JsonImporter';
import { sampleQuiz } from '../../data/sampleQuiz';
import { parseQuizJson, type ImportSettings } from '../../utils/quizSchema';

const settings: ImportSettings = {
  fallbackId: 'quiz-1',
  timeLimitMinutes: 25,
  templateMode: 'paginated',
  antiCheat: {
    enabled: false,
    tabLock: true,
    uiRestrictions: true,
    fullscreenLock: true,
  },
};

const paste = (text: string) =>
  fireEvent.change(screen.getByLabelText('Quiz JSON'), {
    target: { value: text },
  });

// The creator owns the text and the parse result; this stands in for it
function Harness({ warnings }: { warnings?: string[] }) {
  const [value, setValue] = useState('');
  const result = value.trim() ? parseQuizJson(value, settings) : null;
  return (
    <JsonImporter
      value={value}
      onChange={setValue}
      result={result}
      warnings={warnings}
    />
  );
}

describe('JsonImporter', () => {
  it('waits for input before showing anything', () => {
    render(<Harness />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('summarises a valid quiz and has no Start button of its own', () => {
    render(<Harness />);

    paste(JSON.stringify(sampleQuiz));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Total Questions: 5 | Time Limit: 25 minutes | 1 Question / Page',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'DevOps Basics Practice',
    );
    expect(screen.queryByRole('button', { name: /Start Quiz/ })).toBeNull();
  });

  it('shows the text it was given', () => {
    render(
      <JsonImporter value="kept text" onChange={() => {}} result={null} />,
    );

    expect(screen.getByLabelText('Quiz JSON')).toHaveValue('kept text');
  });

  it('shows what is wrong and blocks starting', () => {
    render(<Harness />);

    paste('{"title": "x", "questions": []}');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'questions: Add at least one question.',
    );
    expect(screen.getByLabelText('Quiz JSON')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lists every problem and asks the AI to fix all of them', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<Harness />);
    paste(
      JSON.stringify({
        title: '',
        questions: [
          { ...sampleQuiz.questions[0], correctAnswer: 'zzz' },
          { ...sampleQuiz.questions[1], type: 'essay' },
        ],
      }),
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('3 problems found:')).toBeInTheDocument();
    expect(within(alert).getAllByRole('listitem')).toHaveLength(3);
    expect(alert).toHaveTextContent('title: Add a quiz title.');

    await user.click(
      screen.getByRole('button', { name: 'Copy Error for AI Fix' }),
    );
    const request = writeText.mock.lastCall?.[0] ?? '';
    expect(request).toContain('3 validation errors');
    expect(request).toContain('1. title: Add a quiz title.');
    expect(request).toContain('3. Question 2:');
  });

  it('copies a fix request for the AI', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<Harness />);
    paste('{"title": "x", "questions": []}');

    await user.click(
      screen.getByRole('button', { name: 'Copy Error for AI Fix' }),
    );

    expect(writeText.mock.lastCall?.[0]).toContain(
      'questions: Add at least one question.',
    );
    expect(
      screen.getByRole('button', { name: 'Error Copied!' }),
    ).toBeInTheDocument();
  });

  it('reads an uploaded .json file', async () => {
    render(<Harness />);
    const file = new File([JSON.stringify(sampleQuiz)], 'quiz.json', {
      type: 'application/json',
    });

    await userEvent.upload(
      screen.getByLabelText('browse files from computer'),
      file,
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Total Questions: 5',
      ),
    );
  });

  it('shows the warnings under the valid-JSON message, which stays', () => {
    render(<Harness warnings={['Asked for 9 questions, got 5.', 'Odd.']} />);
    paste(JSON.stringify(sampleQuiz));

    const warnings = screen.getByRole('status', { name: 'Import warnings' });
    expect(warnings).toHaveTextContent('Asked for 9 questions, got 5.');
    expect(warnings).toHaveTextContent('Odd.');
    expect(screen.getByText(sampleQuiz.title)).toBeInTheDocument();
    expect(screen.getByText(/Total Questions/)).toBeInTheDocument();
  });

  it('shows no warning box without warnings, or while the JSON is invalid', () => {
    const { rerender } = render(<Harness warnings={[]} />);
    paste(JSON.stringify(sampleQuiz));
    expect(
      screen.queryByRole('status', { name: 'Import warnings' }),
    ).toBeNull();

    rerender(<Harness warnings={['Odd.']} />);
    paste('{"title": "Oops",');
    expect(
      screen.queryByRole('status', { name: 'Import warnings' }),
    ).toBeNull();
  });
});
