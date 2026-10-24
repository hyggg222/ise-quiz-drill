// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockTestCreator } from './MockTestCreator';
import { sampleQuiz } from '../../data/sampleQuiz';
import { presets } from '../../utils/presets';

const promptBox = () =>
  screen.getByRole('region', { name: 'Compiled AI System Prompt' });
const updateButton = () =>
  screen.getByRole('button', { name: 'Update Prompt' });
const toStep2 = () =>
  userEvent.click(screen.getByRole('button', { name: 'I already have JSON' }));
const toStep1 = () =>
  userEvent.click(
    screen.getByRole('button', { name: 'Write new questions with AI' }),
  );
const startButton = () =>
  screen.getByRole('button', { name: 'Start Quiz Simulation Now' });
// The options start empty, so a test that builds a prompt fills them first
async function fillOptions(count = '10') {
  const field = screen.getByLabelText('Number of Questions');
  await userEvent.clear(field);
  await userEvent.type(field, count);
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Multiple Choice' }),
  );
}
const paste = (text: string) =>
  fireEvent.change(screen.getByLabelText('Quiz JSON'), {
    target: { value: text },
  });

afterEach(() => vi.unstubAllGlobals());

describe('MockTestCreator', () => {
  it('leaves the community library to its own view', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<MockTestCreator onStart={() => {}} />);

    expect(
      screen.queryByRole('region', { name: 'Community Library' }),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens on step 1 with the prompt options and no title or settings', () => {
    render(<MockTestCreator onStart={() => {}} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mock Test Creator' }),
    ).toBeInTheDocument();
    const step1 = screen.getByRole('region', {
      name: 'Step 1 · Create test content',
    });
    expect(
      within(step1).getByLabelText('Number of Questions'),
    ).toBeInTheDocument();
    expect(
      within(step1).getByRole('region', { name: 'Compiled AI System Prompt' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Test Title')).toBeNull();
    expect(screen.queryByLabelText('Time Limit (Minutes)')).toBeNull();
    expect(screen.queryByLabelText('Quiz JSON')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Write new questions with AI' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('goes straight to step 2 for someone who already has JSON', async () => {
    render(<MockTestCreator onStart={() => {}} />);

    await toStep2();

    const step2 = screen.getByRole('region', {
      name: 'Step 2 · Import & settings',
    });
    expect(within(step2).getByLabelText('Quiz JSON')).toBeInTheDocument();
    expect(within(step2).getByLabelText('Test Title')).toBeInTheDocument();
    expect(
      within(step2).getByLabelText('Time Limit (Minutes)'),
    ).toBeInTheDocument();
    expect(
      within(step2).getByRole('checkbox', { name: 'Enable Anti-Cheat' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Number of Questions')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'I already have JSON' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('moves to step 2 with the Next button', async () => {
    render(<MockTestCreator onStart={() => {}} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Next: import JSON' }),
    );

    expect(screen.getByLabelText('Quiz JSON')).toBeInTheDocument();
    expect(screen.queryByLabelText('Number of Questions')).toBeNull();
  });

  it('starts with nothing filled in and lists what is missing in the prompt box', () => {
    render(<MockTestCreator onStart={() => {}} />);

    expect(promptBox()).not.toHaveTextContent('Total Questions');
    expect(within(promptBox()).getByRole('alert')).toHaveTextContent(
      'Choose between 1 and 50 questions.',
    );
    expect(within(promptBox()).getByRole('alert')).toHaveTextContent(
      'Select at least one question type.',
    );
    expect(updateButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy Locked' })).toBeDisabled();
  });

  it('drops each error as its option is filled in', async () => {
    render(<MockTestCreator onStart={() => {}} />);

    await userEvent.type(screen.getByLabelText('Number of Questions'), '10');
    expect(within(promptBox()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(promptBox()).getByRole('alert')).toHaveTextContent(
      'Select at least one question type.',
    );

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Multiple Choice' }),
    );
    expect(within(promptBox()).queryByRole('alert')).toBeNull();
    expect(updateButton()).toBeEnabled();
  });

  it('builds the prompt on Update and then allows copying it', async () => {
    render(<MockTestCreator onStart={() => {}} />);
    await fillOptions();

    await userEvent.click(updateButton());

    expect(promptBox()).toHaveTextContent('Total Questions: 10');
    expect(
      screen.getByRole('button', { name: 'Prompt Up to Date' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Copy AI Prompt' }),
    ).toBeEnabled();
  });

  it('marks the prompt out of date when a prompt option changes', async () => {
    render(<MockTestCreator onStart={() => {}} />);
    await fillOptions();
    await userEvent.click(updateButton());

    const count = screen.getByLabelText('Number of Questions');
    await userEvent.clear(count);
    await userEvent.type(count, '12');

    expect(promptBox()).toHaveTextContent('Total Questions: 10');
    expect(updateButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copy Locked' })).toBeDisabled();

    await userEvent.click(updateButton());
    expect(promptBox()).toHaveTextContent('Total Questions: 12');
  });

  it('keeps everything typed when moving between the steps', async () => {
    render(<MockTestCreator onStart={() => {}} />);
    await fillOptions('12');
    await userEvent.click(updateButton());

    await toStep2();
    await userEvent.type(screen.getByLabelText('Test Title'), 'My Midterm');
    await userEvent.click(
      screen.getByRole('button', { name: 'Scroll Form (All Questions)' }),
    );
    paste(JSON.stringify(sampleQuiz));
    await toStep1();

    expect(screen.getByLabelText('Number of Questions')).toHaveValue(12);
    expect(promptBox()).toHaveTextContent('Total Questions: 12');
    expect(
      screen.getByRole('button', { name: 'Prompt Up to Date' }),
    ).toBeDisabled();

    await toStep2();
    expect(screen.getByLabelText('Quiz JSON')).toHaveValue(
      JSON.stringify(sampleQuiz),
    );
    expect(screen.getByLabelText('Test Title')).toHaveValue('My Midterm');
    expect(
      screen.getByRole('button', { name: 'Scroll Form (All Questions)' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not build a prompt while every question type is unticked', async () => {
    render(<MockTestCreator onStart={() => {}} />);
    await fillOptions();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Multiple Choice' }),
    );

    expect(updateButton()).toBeDisabled();
    expect(promptBox()).toHaveTextContent('Select at least one question type.');
    expect(promptBox()).not.toHaveTextContent('Total Questions');
  });

  it('keeps Start locked until the JSON is valid and says why', async () => {
    render(<MockTestCreator onStart={() => {}} />);
    await toStep2();

    expect(startButton()).toBeDisabled();
    expect(screen.getByText('Paste valid JSON first')).toBeInTheDocument();

    paste('{"title": "Oops",');
    expect(startButton()).toBeDisabled();

    paste(JSON.stringify(sampleQuiz));
    expect(startButton()).toBeEnabled();
    expect(screen.queryByText('Paste valid JSON first')).toBeNull();
  });

  it('starts with the title from the JSON when the title field is left empty', async () => {
    const onStart = vi.fn();
    render(<MockTestCreator onStart={onStart} />);
    await toStep2();
    paste(JSON.stringify(sampleQuiz));

    expect(screen.getByLabelText('Test Title')).toHaveAttribute(
      'placeholder',
      sampleQuiz.title,
    );
    await userEvent.click(startButton());

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ title: sampleQuiz.title }),
    );
  });

  it('starts with the title and time limit chosen here, which win over the JSON', async () => {
    const onStart = vi.fn();
    render(<MockTestCreator onStart={onStart} />);
    await toStep2();
    paste(JSON.stringify(sampleQuiz));

    await userEvent.type(screen.getByLabelText('Test Title'), 'My Midterm');
    const time = screen.getByLabelText('Time Limit (Minutes)');
    await userEvent.clear(time);
    await userEvent.type(time, '30');
    await userEvent.click(startButton());

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My Midterm', timeLimitMinutes: 30 }),
    );
  });

  it('blocks Start for a time limit out of range', async () => {
    render(<MockTestCreator onStart={() => {}} />);
    await toStep2();
    paste(JSON.stringify(sampleQuiz));

    const time = screen.getByLabelText('Time Limit (Minutes)');
    await userEvent.clear(time);
    await userEvent.type(time, '0');

    expect(startButton()).toBeDisabled();
  });

  describe('presets', () => {
    const preset = presets[0];
    // Step 1 has another status line, in the prompt box
    const presetStatus = () =>
      within(screen.getByRole('group', { name: 'Exam preset' })).getByRole(
        'status',
      );
    const pick = async (id: string) => {
      await userEvent.selectOptions(
        screen.getByLabelText('Exam preset (optional)'),
        id,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Apply preset' }),
      );
    };

    it('fills the prompt options from a preset in step 1 and keeps them editable', async () => {
      render(<MockTestCreator onStart={() => {}} />);
      await pick(preset.id);

      const count = screen.getByLabelText('Number of Questions');
      expect(count).toHaveValue(preset.prompt.questionCount);
      expect(presetStatus()).toHaveTextContent(
        `Applied ${preset.name} to the prompt options.`,
      );

      await userEvent.clear(count);
      await userEvent.type(count, '7');
      expect(count).toHaveValue(7);
    });

    it('fills the test settings from a preset in step 2 without a visit to step 1', async () => {
      render(<MockTestCreator onStart={() => {}} />);
      await toStep2();
      await pick(preset.id);

      expect(screen.getByLabelText('Test Title')).toHaveValue(
        preset.config.title,
      );
      expect(screen.getByLabelText('Time Limit (Minutes)')).toHaveValue(
        preset.config.timeLimitMinutes,
      );
      expect(presetStatus()).toHaveTextContent(
        `Applied ${preset.name} to the test settings.`,
      );
    });

    it('keeps the two steps apart: a preset in step 2 leaves step 1 alone', async () => {
      render(<MockTestCreator onStart={() => {}} />);
      await toStep2();
      await pick(preset.id);
      await toStep1();

      expect(screen.getByLabelText('Number of Questions')).not.toHaveValue(
        preset.prompt.questionCount,
      );
    });

    it('asks before a preset replaces a setting typed by hand', async () => {
      render(<MockTestCreator onStart={() => {}} />);
      await toStep2();
      const title = screen.getByLabelText('Test Title');
      await userEvent.type(title, 'My own title');

      await pick(preset.id);
      expect(
        screen.getByText(`Replace your changes with ${preset.name}?`),
      ).toBeVisible();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(title).toHaveValue('My own title');

      await pick(preset.id);
      await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
      expect(title).toHaveValue(preset.config.title);
    });

    it('resets only the step it is in', async () => {
      render(<MockTestCreator onStart={() => {}} />);
      await pick(preset.id);
      await toStep2();
      await pick(preset.id);
      await userEvent.click(
        screen.getByRole('button', { name: 'Reset to defaults' }),
      );
      expect(screen.getByLabelText('Test Title')).toHaveValue('');

      await toStep1();
      expect(screen.getByLabelText('Number of Questions')).toHaveValue(
        preset.prompt.questionCount,
      );
    });
  });
});
