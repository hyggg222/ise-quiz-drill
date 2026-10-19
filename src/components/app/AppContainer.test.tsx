// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContainer } from './AppContainer';
import { loadSavedQuizzes } from '../../utils/attemptStorage';
import { sampleQuiz } from '../../data/sampleQuiz';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mainNav = () => screen.getByRole('navigation', { name: 'Main' });

async function startImportedQuiz(title = sampleQuiz.title) {
  await userEvent.click(
    screen.getByRole('button', { name: 'I already have JSON' }),
  );
  await userEvent.type(screen.getByLabelText('Test Title'), title);
  fireEvent.change(screen.getByLabelText('Quiz JSON'), {
    target: { value: JSON.stringify(sampleQuiz) },
  });
  await userEvent.click(
    screen.getByRole('button', { name: 'Start Quiz Simulation Now' }),
  );
}

async function finishQuiz() {
  await userEvent.click(screen.getByRole('button', { name: 'Submit Quiz' }));
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Submit Quiz',
    }),
  );
}

describe('AppContainer', () => {
  it('opens on the creator with the main navigation', () => {
    render(<AppContainer />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mock Test Creator' }),
    ).toBeInTheDocument();
    expect(
      within(mainNav()).getByRole('button', { name: 'Test Creator' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('changes and remembers the selected appearance', async () => {
    render(<AppContainer />);

    await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('quiz-drill-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('restores the saved appearance when the app opens', () => {
    localStorage.setItem('quiz-drill-theme', 'dark');

    render(<AppContainer />);

    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('uses the operating system appearance when no preference is saved', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

    render(<AppContainer />);

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('quiz-drill-theme')).toBe('dark');
  });

  it('prefers a saved appearance over the operating system setting', () => {
    localStorage.setItem('quiz-drill-theme', 'light');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

    render(<AppContainer />);

    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('quiz-drill-theme')).toBe('light');
  });

  it('saves a quiz started from the creator and runs it without the navigation', async () => {
    render(<AppContainer />);

    await startImportedQuiz();

    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Appearance' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(loadSavedQuizzes(localStorage).map((q) => q.title)).toEqual([
      'DevOps Basics Practice',
    ]);
  });

  it('returns to the creator after a quiz and reviews the attempt from the library', async () => {
    render(<AppContainer />);
    await startImportedQuiz();
    await finishQuiz();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Back to Creator' })[0],
    );

    await userEvent.click(
      within(mainNav()).getByRole('button', { name: /Saved Library/ }),
    );
    await userEvent.click(
      screen.getByRole('tab', { name: /Attempt History \(1\)/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(
      screen.getByRole('region', { name: 'Quiz Submission Overview' }),
    ).toBeInTheDocument();
  });

  it('counts saved tests in the navigation and starts one from the library', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AppContainer />);
    await startImportedQuiz();
    await userEvent.click(screen.getByRole('button', { name: 'Exit quiz' }));

    const library = within(mainNav()).getByRole('button', {
      name: /Saved Library/,
    });
    expect(library).toHaveTextContent('1');
    await userEvent.click(library);
    await userEvent.click(screen.getByRole('button', { name: 'Start Quiz' }));

    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('starts a quiz from the library with a fresh attempt, not the last run', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AppContainer />);
    await startImportedQuiz();
    await userEvent.click(screen.getAllByRole('radio')[0]);
    expect(screen.getByText('1 of 5 questions saved')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Exit quiz' }));

    await userEvent.click(
      within(mainNav()).getByRole('button', { name: /Saved Library/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start Quiz' }));

    expect(screen.getByText('0 of 5 questions saved')).toBeInTheDocument();
  });

  it('saves wrong answers locally and creates a review prompt from the library', async () => {
    render(<AppContainer />);
    await startImportedQuiz();
    await finishQuiz();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save for review' })[0],
    );
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Back to Creator' })[0],
    );

    await userEvent.click(
      within(mainNav()).getByRole('button', { name: /Saved Library/ }),
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Review (1)' }));

    expect(
      screen.getByText('What does this function return for an input of 7?'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'Include question 1 in review test',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create review test (1/15)' }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Step 1 · Create test content',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText((text) =>
        text.includes('What does this function return for an input of 7?'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Review questions: 60% · New questions: 40%'),
    ).toBeInTheDocument();
  });
});
