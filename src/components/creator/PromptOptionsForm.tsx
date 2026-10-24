import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { QuestionType } from '../../types/quiz';
import {
  easyToHardText,
  type DifficultyMode,
  type PromptOptions,
} from '../../utils/promptBuilder';
import { fieldLabel, textInput, toNumber } from './formFields';

export interface PromptOptionsFormProps {
  value: PromptOptions;
  onChange: (next: PromptOptions) => void;
}

const DIFFICULTIES: { id: DifficultyMode; label: string }[] = [
  { id: 'auto', label: 'Auto (AI Decides)' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'custom', label: 'Custom % Breakdown' },
];

const TYPES: { id: QuestionType; label: string }[] = [
  { id: 'mcq', label: 'Multiple Choice' },
  { id: 'multi-select', label: 'Multi-Select' },
  { id: 'true-false', label: 'True / False' },
  { id: 'short-answer', label: 'Short Answer' },
  { id: 'multi-blank', label: 'Multi-Blank' },
];

const CHIPS = [
  {
    label: '+ Code Snippets & Output',
    text: 'Include code snippets for at least 2-3 questions asking to predict the output or find compilation errors.',
  },
  {
    label: '+ Scenario-Based',
    text: 'Structure questions around real-world application scenarios and architectural design problems.',
  },
  {
    label: '+ Tricky Edge Cases',
    text: 'Focus on tricky edge cases, subtle traps, and common student misunderstandings.',
  },
  {
    label: '+ Step-by-Step Explanation',
    text: 'Provide thorough, step-by-step explanations for each correct answer.',
  },
  { label: '+ Order Easy to Hard', text: easyToHardText },
];

// Mouse focus on a button or checkbox is not :focus-visible, keyboard focus is
const isKeyboardFocus = (el: EventTarget) => {
  try {
    return (el as Element).matches(':focus-visible');
  } catch {
    return true;
  }
};

const pctInput =
  'w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-bold focus:ring-2 focus:ring-[#006fbf] outline-none';
const typeChoice =
  'flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer bg-gray-50 border border-gray-200 p-2.5 rounded-lg hover:bg-gray-100';

// Yellow because the field is only unfinished, not wrong
const FieldWarning: React.FC<{ id: string; children: React.ReactNode }> = ({
  id,
  children,
}) => (
  <p
    id={id}
    className="flex items-center gap-2 text-xs font-semibold text-amber-700 mt-2"
  >
    <AlertTriangle
      aria-hidden="true"
      className="w-4 h-4 text-amber-600 flex-shrink-0"
    />
    <span>{children}</span>
  </p>
);

export const PromptOptionsForm: React.FC<PromptOptionsFormProps> = ({
  value,
  onChange,
}) => {
  const [isPctFocused, setIsPctFocused] = useState(false);
  // Fields run top to bottom. A field's warning stays hidden until the user
  // reaches something below it, so a fresh form shows none.
  const [revealed, setRevealed] = useState(0);
  const reveal = (below: number) => setRevealed((r) => Math.max(r, below));
  // Not on mouse down: a warning would push the pressed button away before the
  // mouse is released and the click would be lost. A finished click or a
  // keyboard focus is safe.
  const reach = (index: number) => ({
    onClickCapture: () => reveal(index),
    onFocusCapture: (e: React.FocusEvent) => {
      if (isKeyboardFocus(e.target)) reveal(index);
    },
  });
  const set = <K extends keyof PromptOptions>(key: K, next: PromptOptions[K]) =>
    onChange({ ...value, [key]: next });

  const isCountMissing = value.questionCount < 1 && revealed > 0;
  const isNoTypeSelected = value.types.length === 0 && revealed > 1;
  const totalCustomPct = value.mix.easy + value.mix.medium + value.mix.hard;
  const isPctInvalid = value.difficulty === 'custom' && totalCustomPct !== 100;

  const toggleType = (type: QuestionType, on: boolean) => {
    reveal(2);
    set(
      'types',
      TYPES.map((t) => t.id).filter((t) =>
        t === type ? on : value.types.includes(t),
      ),
    );
  };

  // The typed text is kept apart from the number, so a field can be emptied
  const [mixText, setMixText] = useState(() => ({
    easy: String(value.mix.easy),
    medium: String(value.mix.medium),
    hard: String(value.mix.hard),
  }));
  const setMix = (level: keyof PromptOptions['mix'], text: string) => {
    setMixText((prev) => ({ ...prev, [level]: text }));
    set('mix', { ...value.mix, [level]: toNumber(text, 100) });
  };
  // The typed text while it still matches the mix, else the mix set from outside (a preset)
  const mixShown = (level: keyof PromptOptions['mix']) =>
    toNumber(mixText[level], 100) === value.mix[level]
      ? mixText[level]
      : String(value.mix[level]);

  return (
    <form
      aria-label="AI Prompt Options"
      onSubmit={(e) => e.preventDefault()}
      className="space-y-6"
    >
      <div>
        <label htmlFor="prompt-count" className={fieldLabel}>
          Number of Questions
        </label>
        <input
          id="prompt-count"
          type="number"
          min={1}
          max={50}
          value={value.questionCount || ''}
          onChange={(e) => {
            reveal(1);
            set('questionCount', toNumber(e.target.value, 50));
          }}
          aria-describedby={isCountMissing ? 'prompt-count-warning' : undefined}
          className={`${textInput} font-semibold`}
        />
        {isCountMissing && (
          <FieldWarning id="prompt-count-warning">
            Warning: Enter a number of questions between 1 and 50.
          </FieldWarning>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <fieldset
          {...reach(1)}
          aria-describedby={
            isNoTypeSelected ? 'prompt-types-warning' : undefined
          }
          className="space-y-2"
        >
          <legend className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Included Question Types
          </legend>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {TYPES.map((type) => (
              <label key={type.id} className={typeChoice}>
                <input
                  type="checkbox"
                  checked={value.types.includes(type.id)}
                  onChange={(e) => toggleType(type.id, e.target.checked)}
                  className="w-4 h-4 rounded text-[#006fbf]"
                />
                {type.label}
              </label>
            ))}
          </div>

          {isNoTypeSelected && (
            <FieldWarning id="prompt-types-warning">
              Warning: You must select at least one question type for the exam.
            </FieldWarning>
          )}
        </fieldset>
      </div>

      <div {...reach(2)} className="pt-2 space-y-4">
        <div>
          <span
            id="prompt-difficulty"
            className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2"
          >
            Difficulty Level
          </span>
          <div
            role="group"
            aria-labelledby="prompt-difficulty"
            className="flex flex-wrap items-center gap-2"
          >
            {DIFFICULTIES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={value.difficulty === item.id}
                onClick={() => set('difficulty', item.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  value.difficulty === item.id
                    ? 'bg-[#006fbf] text-white border-[#006fbf] shadow-sm'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {value.difficulty === 'custom' && (
          <div className="space-y-3 pt-1">
            <div className="border border-gray-200 rounded-lg p-4 grid grid-cols-3 gap-4">
              {(
                [
                  ['easy', 'Easy %'],
                  ['medium', 'Medium %'],
                  ['hard', 'Hard %'],
                ] as const
              ).map(([level, text]) => (
                <div key={level}>
                  <label
                    htmlFor={`prompt-mix-${level}`}
                    className="block text-xs font-semibold text-gray-700 mb-1"
                  >
                    {text}
                  </label>
                  <input
                    id={`prompt-mix-${level}`}
                    type="number"
                    min={0}
                    max={100}
                    value={mixShown(level)}
                    onChange={(e) => setMix(level, e.target.value)}
                    onFocus={() => setIsPctFocused(true)}
                    onBlur={() => setIsPctFocused(false)}
                    aria-invalid={isPctInvalid ? true : undefined}
                    aria-describedby={
                      isPctInvalid ? 'prompt-mix-error' : undefined
                    }
                    className={pctInput}
                  />
                </div>
              ))}
            </div>

            {/* Hidden while typing in a field, so it does not flash on every key */}
            {isPctInvalid && !isPctFocused && (
              <FieldWarning id="prompt-mix-warning">
                Warning: Total difficulty percentage must equal exactly 100%
                (Current sum: <strong>{totalCustomPct}%</strong>). Please adjust
                values.
              </FieldWarning>
            )}
            {isPctInvalid && (
              <span id="prompt-mix-error" className="sr-only">
                The difficulty mix must add up to 100% (now {totalCustomPct}%).
              </span>
            )}
          </div>
        )}
      </div>

      <div {...reach(3)} className="pt-2">
        <label htmlFor="prompt-topics" className={fieldLabel}>
          Specific Topics / Focus Areas (Optional)
        </label>
        <input
          id="prompt-topics"
          type="text"
          value={value.topics}
          onChange={(e) => set('topics', e.target.value)}
          className={textInput}
        />
      </div>

      <div {...reach(4)} className="pt-2 space-y-2">
        <label htmlFor="prompt-notes" className={fieldLabel}>
          Special Instructions / Custom Notes (Optional)
        </label>
        <textarea
          id="prompt-notes"
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={6}
          className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#006fbf] focus:border-transparent outline-none text-gray-900 font-medium"
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold text-gray-500 mr-1">
            Quick Add Presets:
          </span>
          {CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() =>
                set(
                  'notes',
                  value.notes.trim()
                    ? `${value.notes.trim()}\n${chip.text}`
                    : chip.text,
                )
              }
              className="bg-white hover:bg-[#006fbf] text-[#006fbf] hover:text-white border border-[#006fbf] px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
};
