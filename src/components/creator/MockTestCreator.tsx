import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MessageSquareText, Play, Settings } from 'lucide-react';
import type { QuizConfig } from '../../types/quiz';
import type { SavedReviewQuestion } from '../../types/review';
import { track } from '../../utils/analytics';
import {
  buildPrompt,
  buildReviewPrompt,
  defaultPromptOptions,
  defaultTestConfig,
  validatePromptOptions,
  validateTestConfig,
} from '../../utils/promptBuilder';
import {
  applyPresetConfig,
  applyPresetPrompt,
  describePresetConfig,
  describePresetPrompt,
  presets,
  resetPromptOptions,
  resetTestConfig,
} from '../../utils/presets';
import { parseQuizJson, type ImportSettings } from '../../utils/quizSchema';
import type { ReadyTest } from '../../utils/readyTests';
import { readyTests as builtInReadyTests } from '../../data/readyTests';
import { ReadyTests } from './ReadyTests';
import { CompiledPromptBox } from './CompiledPromptBox';
import { JsonImporter } from './JsonImporter';
import { PresetPicker } from './PresetPicker';
import { PromptOptionsForm } from './PromptOptionsForm';
import { TestConfigForm } from './TestConfigForm';

export interface MockTestCreatorProps {
  onStart: (quiz: QuizConfig) => void;
  readyTests?: ReadyTest[];
  reviewQuestions?: SavedReviewQuestion[];
}

const card =
  'bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6';

// Step 1 writes a prompt for an AI; step 2 turns its JSON into a quiz
type Step = 1 | 2;

const paths = [
  [1, 'Write new questions with AI'],
  [2, 'I already have JSON'],
] as const;

export const MockTestCreator: React.FC<MockTestCreatorProps> = ({
  onStart,
  readyTests = builtInReadyTests,
  reviewQuestions,
}) => {
  // Options, config and JSON text live here, not in the step sections, so
  // they survive a change of step and a preset can fill them from step 1.
  const [step, setStep] = useState<Step>(1);
  const [config, setConfig] = useState(defaultTestConfig);
  const [options, setOptions] = useState(() => {
    if (!reviewQuestions?.length) return defaultPromptOptions;
    return {
      ...defaultPromptOptions,
      questionCount: Math.max(10, reviewQuestions.length),
      types: [...new Set(reviewQuestions.map((saved) => saved.question.type))],
      topics: 'Review the concepts represented by the saved questions.',
    };
  });
  const [reviewPercentage, setReviewPercentage] = useState(60);
  const [jsonText, setJsonText] = useState('');
  // One id per creator session, so the prompt text stays the same
  const [quizId] = useState(() => `quiz-${Date.now()}`);
  // The prompt is only rebuilt on request; `key` tells which options it used
  const [built, setBuilt] = useState<{ key: string; prompt: string } | null>(
    () =>
      reviewQuestions?.length
        ? {
            key: JSON.stringify({ options, reviewPercentage: 60 }),
            prompt: buildReviewPrompt(options, quizId, reviewQuestions, 60),
          }
        : null,
  );

  const promptKey = JSON.stringify({ options, reviewPercentage });
  const optionsErrors = validatePromptOptions(options);
  const isStale = built?.key !== promptKey;

  const handleUpdate = () => {
    if (optionsErrors.length > 0) return;
    setBuilt({
      key: promptKey,
      prompt: reviewQuestions?.length
        ? buildReviewPrompt(options, quizId, reviewQuestions, reviewPercentage)
        : buildPrompt(options, quizId),
    });
  };

  // The title is not passed on: an empty title field keeps the JSON's own
  const settings = useMemo<ImportSettings>(
    () => ({
      fallbackId: quizId,
      timeLimitMinutes: config.timeLimitMinutes,
      templateMode: config.templateMode,
      antiCheat: config.antiCheat,
    }),
    [config.timeLimitMinutes, config.templateMode, config.antiCheat, quizId],
  );
  const result = useMemo(
    () => (jsonText.trim() ? parseQuizJson(jsonText, settings) : null),
    [jsonText, settings],
  );

  // Once per change between valid and invalid JSON, not once per keystroke
  const importValid = result ? result.ok : null;
  useEffect(() => {
    if (importValid !== null) {
      track({ event: 'quiz_imported', props: { valid: importValid } });
    }
  }, [importValid]);

  const quiz =
    result?.ok === true
      ? { ...result.quiz, title: config.title.trim() || result.quiz.title }
      : null;
  const blockedReason = quiz
    ? validateTestConfig(config)
    : 'Paste valid JSON first';

  return (
    <div className="w-full max-w-[1150px] mx-auto p-6 space-y-8 font-sans">
      <div className="border-b border-gray-200 pb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Mock Test Creator
            </h1>
          </div>
          <p className="text-gray-600 text-sm mt-1">
            Compile a tailored AI Prompt, or import JSON questions you already
            have.
          </p>
        </div>
      </div>

      <ReadyTests tests={readyTests} onStart={(test) => onStart(test.quiz)} />

      <div className={card}>
        <span
          id="creator-path"
          className="block text-xs font-bold uppercase tracking-wider text-gray-700"
        >
          {readyTests.length > 0
            ? 'Or make your own: where do your questions come from?'
            : 'Where do your questions come from?'}
        </span>
        <div
          role="group"
          aria-labelledby="creator-path"
          className="inline-flex border border-gray-300 rounded-lg overflow-hidden"
        >
          {paths.map(([target, text]) => (
            <button
              key={target}
              type="button"
              aria-pressed={step === target}
              onClick={() => setStep(target)}
              className={`px-4 py-2 text-sm font-semibold cursor-pointer ${
                target === 2 ? 'border-l border-gray-300' : ''
              } ${
                step === target
                  ? 'bg-[#006fbf] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {step === 1 ? (
        <section aria-labelledby="step-1-title" className={card}>
          <div className="border-b border-gray-100 pb-4">
            <h2
              id="step-1-title"
              className="text-xl font-bold text-gray-900 flex items-center gap-2"
            >
              <MessageSquareText
                aria-hidden="true"
                className="w-5 h-5 flex-shrink-0 text-[#006fbf]"
              />
              Step 1 · Create test content
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Describe the questions, build the prompt and copy it to your AI.
              Then continue with step 2.
            </p>
          </div>

          <PresetPicker
            scope="the prompt options"
            presets={presets}
            value={options}
            onChange={setOptions}
            applyPreset={applyPresetPrompt}
            reset={resetPromptOptions}
            describe={describePresetPrompt}
          />

          {reviewQuestions?.length ? (
            <fieldset className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <legend className="px-1 text-sm font-bold text-blue-950">
                Review test mix
              </legend>
              <label
                htmlFor="review-question-share"
                className="flex items-center justify-between gap-4 text-sm font-semibold text-blue-950"
              >
                <span>
                  Review questions: {reviewPercentage}% · New questions:{' '}
                  {100 - reviewPercentage}%
                </span>
                <input
                  id="review-question-share"
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={reviewPercentage}
                  onChange={(event) =>
                    setReviewPercentage(Number(event.target.value))
                  }
                  className="w-40 accent-[#006fbf]"
                />
              </label>
              <p className="mt-2 text-xs text-blue-900">
                Adjust the balance. The prompt includes your selected mistakes
                and asks the AI to write fresh questions without copying them.
              </p>
            </fieldset>
          ) : null}

          <PromptOptionsForm value={options} onChange={setOptions} />

          <CompiledPromptBox
            prompt={built?.prompt ?? null}
            isStale={isStale}
            errors={optionsErrors}
            onUpdate={handleUpdate}
            onCopied={() =>
              track({
                event: 'prompt_copied',
                props: { questionCount: options.questionCount },
              })
            }
          />

          <div className="border-t border-gray-100 pt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-2.5 rounded-lg font-bold text-sm bg-[#006fbf] hover:bg-[#005694] text-white flex items-center gap-2 cursor-pointer"
            >
              Next: import JSON
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        </section>
      ) : (
        <section aria-labelledby="step-2-title" className={card}>
          <div className="border-b border-gray-100 pb-4">
            <h2
              id="step-2-title"
              className="text-xl font-bold text-gray-900 flex items-center gap-2"
            >
              <Settings
                aria-hidden="true"
                className="w-5 h-5 flex-shrink-0 text-[#006fbf]"
              />
              Step 2 · Import & settings
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Paste or drop the JSON, adjust the settings the app applies (they
              are not sent to the AI), then start.
            </p>
          </div>

          <JsonImporter
            value={jsonText}
            onChange={setJsonText}
            result={result}
          />

          <div className="border-t border-gray-100 pt-6 space-y-6">
            <PresetPicker
              scope="the test settings"
              presets={presets}
              value={config}
              onChange={setConfig}
              applyPreset={applyPresetConfig}
              reset={resetTestConfig}
              describe={describePresetConfig}
            />
            <TestConfigForm
              value={config}
              onChange={setConfig}
              titleFallback={result?.ok ? result.quiz.title : ''}
            />
          </div>

          <div className="border-t border-gray-100 pt-4 flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => quiz && onStart(quiz)}
              disabled={!quiz || !!blockedReason}
              className={`px-8 py-3 rounded-lg font-bold text-base flex items-center gap-2 ${
                !quiz || blockedReason
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-[#006fbf] hover:bg-[#005694] text-white shadow-md cursor-pointer'
              }`}
            >
              <Play aria-hidden="true" className="w-5 h-5 fill-current" /> Start
              Quiz Simulation Now
            </button>
            {blockedReason && (
              <span className="text-xs font-semibold text-gray-700">
                {blockedReason}
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
