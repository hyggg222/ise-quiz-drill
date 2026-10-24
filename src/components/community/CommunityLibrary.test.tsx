// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommunityLibrary } from './CommunityLibrary';
import { sampleQuiz } from '../../data/sampleQuiz';
import type { QuizConfig } from '../../types/quiz';

const page = () => screen.getByRole('region', { name: 'Community Library' });

const quiz = (over: Partial<QuizConfig> = {}): QuizConfig => ({
  ...sampleQuiz,
  id: 'java-io',
  title: 'Java IO',
  timeLimitMinutes: 15,
  templateMode: 'paginated',
  ...over,
});

describe('CommunityLibrary', () => {
  it('shows each test as the Saved library card, without Delete', () => {
    render(
      <CommunityLibrary
        onStart={() => {}}
        tests={[quiz(), quiz({ id: 'two', title: 'Two' })]}
      />,
    );

    const cards = within(page()).getAllByRole('article');
    expect(cards).toHaveLength(2);
    const card = cards[0];
    expect(
      within(card).getByRole('heading', { name: 'Java IO' }),
    ).toBeVisible();
    expect(card).toHaveTextContent(sampleQuiz.courseCode);
    expect(card).toHaveTextContent(`${sampleQuiz.questions.length} Questions`);
    expect(card).toHaveTextContent('15 Minutes');
    expect(
      within(card).getByRole('button', { name: 'Start Quiz' }),
    ).toBeVisible();
    expect(within(card).getByRole('button', { name: 'Export' })).toBeVisible();
    expect(within(card).queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('exports a test as a JSON file, as the Saved library does', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:quiz');
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('java_io.json');
      });
    render(<CommunityLibrary onStart={() => {}} tests={[quiz()]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('shows No tests published yet for an empty library', () => {
    render(<CommunityLibrary onStart={() => {}} tests={[]} />);

    expect(
      within(page()).getByText('No tests published yet'),
    ).toBeInTheDocument();
    expect(within(page()).queryByRole('article')).toBeNull();
  });

  it('starts a test under the id community-plus-id', async () => {
    const onStart = vi.fn();
    render(<CommunityLibrary onStart={onStart} tests={[quiz()]} />);

    await userEvent.click(
      within(screen.getByRole('article', { name: 'Java IO' })).getByRole(
        'button',
        { name: 'Start Quiz' },
      ),
    );

    expect(onStart).toHaveBeenCalledWith({
      ...quiz(),
      id: 'community-java-io',
    });
  });

  it('lists the bundled tests when none are given', () => {
    render(<CommunityLibrary onStart={() => {}} />);

    expect(within(page()).getAllByRole('article').length).toBeGreaterThan(0);
  });
});
