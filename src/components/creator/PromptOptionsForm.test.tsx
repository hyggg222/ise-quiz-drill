// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptOptionsForm } from './PromptOptionsForm';
import {
  defaultPromptOptions,
  easyToHardText,
  type PromptOptions,
} from '../../utils/promptBuilder';

function Harness({
  onChange = () => {},
}: {
  onChange?: (o: PromptOptions) => void;
}) {
  const [value, setValue] = useState(defaultPromptOptions);
  return (
    <PromptOptionsForm
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const last = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.lastCall?.[0] as PromptOptions;

describe('PromptOptionsForm', () => {
  it('edits the question count through a labelled field', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const count = screen.getByLabelText('Number of Questions');
    await userEvent.clear(count);
    await userEvent.type(count, '20');

    expect(last(onChange)).toMatchObject({ questionCount: 20 });
  });

  it('asks for the question types, then the difficulty, then the topics', () => {
    render(<Harness />);
    const types = screen.getByRole('group', {
      name: 'Included Question Types',
    });
    const difficulty = screen.getByRole('group', { name: 'Difficulty Level' });
    const topics = screen.getByLabelText(/Specific Topics/);
    const before = (first: Element, second: Element) =>
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(before(types, difficulty)).toBeTruthy();
    expect(before(difficulty, topics)).toBeTruthy();
  });

  it('starts empty except for the difficulty', () => {
    render(<Harness />);
    const group = screen.getByRole('group', {
      name: 'Included Question Types',
    });

    expect(screen.getByLabelText('Number of Questions')).toHaveValue(null);
    for (const box of within(group).getAllByRole('checkbox')) {
      expect(box).not.toBeChecked();
    }
    expect(
      screen.getByRole('button', { name: 'Auto (AI Decides)' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves the test settings to the test configuration', () => {
    render(<Harness />);

    expect(screen.queryByLabelText(/Test Title/)).toBeNull();
    expect(screen.queryByLabelText(/Time Limit/)).toBeNull();
    expect(screen.queryByText('Test Layout Mode')).toBeNull();
    expect(screen.queryByText(/Anti-Cheat/i)).toBeNull();
  });

  it('picks the difficulty with toggle buttons and shows the mix for custom', async () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Difficulty Level' });
    expect(
      within(group).getByRole('button', { name: 'Auto (AI Decides)' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Easy %')).toBeNull();

    await userEvent.click(
      within(group).getByRole('button', { name: 'Custom % Breakdown' }),
    );

    expect(screen.getByLabelText('Easy %')).toHaveValue(30);
  });

  it('flags a custom mix that does not add up to 100%', async () => {
    render(<Harness />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Custom % Breakdown' }),
    );

    const hard = screen.getByLabelText('Hard %');
    await userEvent.clear(hard);
    await userEvent.type(hard, '10');
    await userEvent.tab();

    expect(hard).toHaveAttribute('aria-invalid', 'true');
    expect(hard).toHaveAccessibleDescription(
      'The difficulty mix must add up to 100% (now 90%).',
    );
    expect(screen.getByText(/Current sum:/)).toHaveTextContent('90%');
  });

  it('lets the custom percentages be cleared completely while typing', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Custom % Breakdown' }),
    );

    const easy = screen.getByLabelText('Easy %');
    await userEvent.clear(easy);

    expect(easy).toHaveValue(null);
    expect(last(onChange).mix.easy).toBe(0);

    await userEvent.type(easy, '25');
    expect(easy).toHaveValue(25);
    expect(last(onChange).mix.easy).toBe(25);
  });

  it('shows no example text in the input fields', () => {
    render(<Harness />);

    for (const field of screen.getAllByRole('textbox')) {
      expect(field).not.toHaveAttribute('placeholder');
    }
  });

  describe('warnings for required options', () => {
    const countWarning = /Enter a number of questions between 1 and 50/;
    const typesWarning = /You must select at least one question type/;

    it('shows none when the form first opens', () => {
      render(<Harness />);

      expect(screen.queryByText(countWarning)).toBeNull();
      expect(screen.queryByText(typesWarning)).toBeNull();
    });

    it('does not warn about the field the user is in or the ones below it', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByLabelText('Number of Questions'));

      expect(screen.queryByText(countWarning)).toBeNull();
      expect(screen.queryByText(typesWarning)).toBeNull();
    });

    it('warns about an empty question count once the user moves on to the difficulty', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByRole('button', { name: 'Easy' }));

      expect(screen.getByText(countWarning)).toBeInTheDocument();
      expect(
        screen.getByLabelText('Number of Questions'),
      ).toHaveAccessibleDescription(/Enter a number of questions/);
    });

    it('warns about the types too, but only for fields above the one used', async () => {
      render(<Harness />);

      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Multi-Select' }),
      );

      expect(screen.getByText(countWarning)).toBeInTheDocument();
      expect(screen.queryByText(typesWarning)).toBeNull();
    });

    it('warns about the types once the user reaches the difficulty or later fields', async () => {
      render(<Harness />);

      await userEvent.click(
        screen.getByRole('button', { name: 'Custom % Breakdown' }),
      );

      expect(screen.getByText(typesWarning)).toBeInTheDocument();
      expect(screen.getByText(countWarning)).toBeInTheDocument();
    });

    it('also warns when the user reaches the topics or the notes', async () => {
      render(<Harness />);

      await userEvent.click(screen.getByLabelText(/Specific Topics/));

      expect(screen.getByText(countWarning)).toBeInTheDocument();
      expect(screen.getByText(typesWarning)).toBeInTheDocument();
    });

    it('drops a warning as soon as its field is filled in', async () => {
      render(<Harness />);
      await userEvent.click(screen.getByRole('button', { name: 'Easy' }));

      await userEvent.type(screen.getByLabelText('Number of Questions'), '10');
      expect(screen.queryByText(countWarning)).toBeNull();

      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Multiple Choice' }),
      );
      expect(screen.queryByText(typesWarning)).toBeNull();
    });

    it('warns at once when a field that had a value is emptied again', async () => {
      render(<Harness />);
      const count = screen.getByLabelText('Number of Questions');
      const mcq = screen.getByRole('checkbox', { name: 'Multiple Choice' });

      await userEvent.type(count, '10');
      await userEvent.clear(count);
      expect(screen.getByText(countWarning)).toBeInTheDocument();

      await userEvent.click(mcq);
      await userEvent.click(mcq);
      expect(screen.getByText(typesWarning)).toBeInTheDocument();
    });
  });

  it('toggles question types', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const group = screen.getByRole('group', {
      name: 'Included Question Types',
    });

    await userEvent.click(
      within(group).getByRole('checkbox', { name: 'True / False' }),
    );
    await userEvent.click(
      within(group).getByRole('checkbox', { name: 'Multi-Blank' }),
    );
    expect(last(onChange).types).toEqual(['true-false', 'multi-blank']);

    for (const box of within(group).getAllByRole('checkbox', {
      checked: true,
    })) {
      await userEvent.click(box);
    }
    expect(last(onChange).types).toEqual([]);
  });

  it('adds the easy to hard instruction to the notes like the other presets', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(
      screen.getByRole('button', { name: '+ Order Easy to Hard' }),
    );

    expect(last(onChange).notes).toBe(easyToHardText);
  });

  it('adds preset instructions to the notes', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(
      screen.getByRole('button', { name: '+ Scenario-Based' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: '+ Tricky Edge Cases' }),
    );

    expect(last(onChange).notes).toBe(
      'Structure questions around real-world application scenarios and architectural design problems.\nFocus on tricky edge cases, subtle traps, and common student misunderstandings.',
    );
  });
});
