import React, { useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Home,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { QuizConfig, QuizEvent } from '../../types/quiz';
import type { Answer } from '../../utils/answers';
import { gradeQuiz } from '../../utils/grading';
import { AppearanceSettings, type Theme } from '../app/AppearanceSettings';
import { QuestionRenderer } from './QuestionRenderer';

export interface ResultsReviewProps {
  quiz: QuizConfig;
  answers: Record<string, Answer | undefined>;
  timeTakenSeconds: number;
  eventLog?: QuizEvent[];
  onRetake: () => void;
  onExit?: () => void;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export type FilterMode = 'incorrect' | 'correct' | 'all';

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
};

// Colours for the audit trail rows, by event type
function eventColours(type: string) {
  if (type.includes('focus_lost') || type.includes('exit')) {
    return {
      row: 'border-gray-200 shadow-[inset_4px_0_0_#f59e0b]',
      text: 'text-gray-900',
      tag: 'bg-amber-500 text-gray-900',
    };
  }
  if (type.includes('attempt') || type.includes('violation')) {
    return {
      row: 'border-gray-200 shadow-[inset_4px_0_0_#dc2626]',
      text: 'text-gray-900',
      tag: 'bg-red-600 text-white',
    };
  }
  if (type.includes('regained')) {
    return {
      row: 'border-gray-200 shadow-[inset_4px_0_0_#16a34a]',
      text: 'text-gray-900',
      tag: 'bg-green-600 text-white',
    };
  }
  return {
    row: 'border-gray-200 shadow-[inset_4px_0_0_#4b5563]',
    text: 'text-gray-900',
    tag: 'bg-gray-600 text-white',
  };
}

export const ResultsReview: React.FC<ResultsReviewProps> = ({
  quiz,
  answers,
  timeTakenSeconds,
  eventLog = [],
  onRetake,
  onExit,
  theme,
  onThemeChange,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('incorrect');

  const { results, earnedScore, totalPoints, percentage } = gradeQuiz(
    quiz,
    answers,
  );
  const correctIds = new Set(
    results.filter((r) => r.isCorrect).map((r) => r.questionId),
  );
  const incorrectCount = results.length - correctIds.size;
  const correctCount = correctIds.size;
  const totalCount = quiz.questions.length;
  const displayedPercentage = Math.round(percentage);
  const scoreBand =
    displayedPercentage >= 90
      ? '90-100'
      : displayedPercentage >= 70
        ? '70-89'
        : displayedPercentage >= 50
          ? '50-69'
          : '0-49';
  const memeVariants = [
    {
      src: `/results/score-${scoreBand}-1.svg`,
      alt: `Score ${displayedPercentage} percent: a cheerful study-themed meme.`,
    },
    {
      src: `/results/score-${scoreBand}-2.svg`,
      alt: `Score ${displayedPercentage} percent: an encouraging quiz-result meme.`,
    },
  ];
  const [scoreMeme] = useState(
    () => memeVariants[Math.floor(Math.random() * memeVariants.length)],
  );

  const filteredQuestions = quiz.questions.filter((q) =>
    filterMode === 'all'
      ? true
      : correctIds.has(q.id) === (filterMode === 'correct'),
  );

  const filterButton = (
    active: boolean,
    activeClass: string,
    idleClass: string,
  ) =>
    `px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
      active ? `${activeClass} text-white` : `${idleClass} hover:bg-white`
    }`;
  const countPill = (active: boolean, activeText: string, idleBg: string) =>
    `px-1.5 py-0.2 rounded-full text-[11px] font-extrabold ${
      active ? `bg-white ${activeText}` : `${idleBg} text-white`
    }`;

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen bg-[#f8fafc] text-gray-900 flex flex-col font-sans select-none overflow-hidden">
      {/* Full-width green accent line */}
      <div
        aria-hidden="true"
        className="w-full h-[4px] bg-[#008000] flex-shrink-0 z-50"
      />

      {/* Top navigation bar */}
      <div className="bg-[#1e293b] text-white px-6 py-3 flex items-center justify-between shadow-md z-40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-bold text-base tracking-tight leading-tight">
              {quiz.title}
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              {quiz.courseCode} • Submission Results
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {theme && onThemeChange && (
            <AppearanceSettings
              theme={theme}
              onChange={onThemeChange}
              darkHeader
            />
          )}
          <button
            type="button"
            onClick={onRetake}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 rounded-md border border-slate-600 transition-colors cursor-pointer"
          >
            <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" /> Retake Quiz
          </button>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#006fbf] hover:bg-[#005694] rounded-md transition-colors cursor-pointer"
            >
              <Home aria-hidden="true" className="w-3.5 h-3.5" /> Back to
              Creator
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
          {/* Summary card */}
          <section
            aria-labelledby="results-summary"
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4"
          >
            <div className="border-b border-gray-100 pb-3">
              <h2
                id="results-summary"
                className="text-xl font-bold text-gray-900"
              >
                Quiz Submission Overview
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Summary of your attempt performance and breakdown
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                <div className="p-3 bg-[#006fbf] text-white rounded-full flex-shrink-0">
                  <Award aria-hidden="true" className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Overall Score
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    {earnedScore} / {totalPoints}{' '}
                    <span className="text-sm font-semibold text-[#006fbf]">
                      ({Math.round(percentage)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                <div className="p-3 bg-gray-700 text-white rounded-full flex-shrink-0">
                  <Clock aria-hidden="true" className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Time Taken
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatDuration(timeTakenSeconds)}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                <div className="p-3 bg-green-600 text-white rounded-full flex-shrink-0">
                  <CheckCircle2 aria-hidden="true" className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">
                    Attempt Status
                  </div>
                  <div className="text-xl font-bold text-green-800">
                    Submitted
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            aria-label="Score reaction"
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <img
              src={scoreMeme.src}
              alt={scoreMeme.alt}
              className="block h-auto w-full"
              width="480"
              height="220"
            />
          </section>

          {/* Proctoring audit trail */}
          {quiz.antiCheat?.enabled && (
            <section
              aria-labelledby="results-audit"
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4"
            >
              <div className="border-b border-gray-100 pb-3">
                <h2
                  id="results-audit"
                  className="text-xl font-bold text-gray-900 flex items-center gap-2"
                >
                  <ShieldAlert
                    aria-hidden="true"
                    className="w-5 h-5 text-red-600"
                  />
                  Proctoring Audit Trail
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automated activity log of test taker behavior.
                </p>
              </div>

              {eventLog.length === 0 ? (
                <div className="bg-green-600 text-white p-4 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold">
                  <CheckCircle2 aria-hidden="true" className="w-5 h-5" /> No
                  violations detected during this attempt.
                </div>
              ) : (
                <ol className="space-y-3 pt-2">
                  {eventLog.map((event, idx) => {
                    const colours = eventColours(event.type);
                    return (
                      <li
                        key={idx}
                        className={`p-3 bg-white rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${colours.row}`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 text-[10.5px] font-bold font-mono tracking-wider uppercase rounded ${colours.tag}`}
                          >
                            {event.type.replace(/_/g, ' ')}
                          </span>
                          <span
                            className={`text-sm font-medium ${colours.text}`}
                          >
                            {event.details}
                          </span>
                        </div>
                        <time
                          dateTime={event.timestamp}
                          className="text-xs font-mono text-gray-600 bg-white px-2 py-1 rounded border border-gray-300"
                        >
                          {new Date(event.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          )}

          {/* Question review */}
          <section
            aria-labelledby="results-questions"
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-3">
              <div>
                <h2
                  id="results-questions"
                  className="text-xl font-bold text-gray-900 flex items-center gap-2"
                >
                  Question Feedback & Explanations
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Filter questions to focus on specific results
                </p>
              </div>

              <div
                role="group"
                aria-label="Show questions"
                className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg border border-gray-200 self-start sm:self-auto"
              >
                <button
                  type="button"
                  aria-pressed={filterMode === 'incorrect'}
                  onClick={() => setFilterMode('incorrect')}
                  className={filterButton(
                    filterMode === 'incorrect',
                    'bg-red-600',
                    'text-red-700',
                  )}
                >
                  <X aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Incorrect Only</span>{' '}
                  <span
                    className={countPill(
                      filterMode === 'incorrect',
                      'text-red-700',
                      'bg-red-600',
                    )}
                  >
                    {incorrectCount}
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={filterMode === 'correct'}
                  onClick={() => setFilterMode('correct')}
                  className={filterButton(
                    filterMode === 'correct',
                    'bg-emerald-600',
                    'text-emerald-700',
                  )}
                >
                  <Check aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Correct</span>{' '}
                  <span
                    className={countPill(
                      filterMode === 'correct',
                      'text-emerald-700',
                      'bg-emerald-600',
                    )}
                  >
                    {correctCount}
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={filterMode === 'all'}
                  onClick={() => setFilterMode('all')}
                  className={filterButton(
                    filterMode === 'all',
                    'bg-[#006fbf]',
                    'text-[#006fbf]',
                  )}
                >
                  <Filter aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>All</span>{' '}
                  <span
                    className={countPill(
                      filterMode === 'all',
                      'text-[#006fbf]',
                      'bg-[#006fbf]',
                    )}
                  >
                    {totalCount}
                  </span>
                </button>
              </div>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div aria-hidden="true" className="text-4xl">
                  🎉
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {filterMode === 'incorrect'
                    ? 'Perfect Score! No incorrect questions.'
                    : 'No questions match this filter.'}
                </h3>
                <p className="text-sm text-gray-500">
                  {filterMode === 'incorrect'
                    ? 'You answered every single question correctly in this attempt.'
                    : 'Try switching to another filter tab above.'}
                </p>
                {filterMode === 'incorrect' && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className="mt-2 px-4 py-2 bg-white hover:bg-[#006fbf] text-[#006fbf] hover:text-white border border-[#006fbf] font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    View All Questions ({totalCount})
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-8 divide-y divide-gray-100 pt-2">
                {filteredQuestions.map((question) => (
                  <div key={question.id} className="pt-6 first:pt-0">
                    <QuestionRenderer
                      question={question}
                      answer={answers[question.id]}
                      isFlagged={false}
                      onAnswerChange={() => {}}
                      onToggleFlag={() => {}}
                      reviewMode
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={onRetake}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-lg border border-gray-300 text-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              <RotateCcw aria-hidden="true" className="w-4 h-4 text-gray-700" />{' '}
              Retake Quiz
            </button>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-8 py-2.5 bg-[#006fbf] hover:bg-[#005694] text-white font-bold rounded-lg shadow-sm text-sm transition-colors cursor-pointer flex items-center gap-2"
              >
                <Home aria-hidden="true" className="w-4 h-4 text-white" />{' '}
                Return to Test Creator
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
