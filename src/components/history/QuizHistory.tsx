import React, { useRef, useState, type KeyboardEvent } from 'react';
import {
  Clock,
  Download,
  Eye,
  FileJson,
  HelpCircle,
  History,
  Play,
  PlusCircle,
  Save,
  Trash2,
} from 'lucide-react';
import type { QuizAttemptRecord, QuizConfig } from '../../types/quiz';
import type { SavedReviewQuestion } from '../../types/review';
import {
  clearHistory,
  deleteHistoryRecord,
  deleteSavedQuiz,
  loadHistory,
  loadSavedQuizzes,
} from '../../utils/attemptStorage';
import {
  deleteReviewQuestion,
  loadReviewQuestions,
} from '../../utils/reviewStorage';
import {
  browserStorage,
  safely,
  type KeyValueStore,
} from '../../utils/browserStorage';

export interface QuizHistoryProps {
  onStart: (quiz: QuizConfig) => void;
  onCreate: () => void;
  onReview?: (record: QuizAttemptRecord) => void;
  onCreateReviewTest?: (questions: SavedReviewQuestion[]) => void;
  storage?: KeyValueStore;
}

type SubTab = 'quizzes' | 'attempts' | 'review';

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
};

function exportJson(quiz: QuizConfig) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = (quiz.title || 'quiz')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  link.download = `${safeTitle}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const tabClass = (active: boolean) =>
  `px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-[#006fbf] ${
    active
      ? 'bg-[#006fbf] text-white'
      : 'bg-white text-[#006fbf] hover:bg-[#006fbf] hover:text-white'
  }`;

export const QuizHistory: React.FC<QuizHistoryProps> = ({
  onStart,
  onCreate,
  onReview,
  onCreateReviewTest,
  storage = browserStorage(),
}) => {
  const [subTab, setSubTab] = useState<SubTab>('quizzes');
  const [savedQuizzes, setSavedQuizzes] = useState(
    () => (storage && safely(() => loadSavedQuizzes(storage))) ?? [],
  );
  const [attempts, setAttempts] = useState(
    () => (storage && safely(() => loadHistory(storage))) ?? [],
  );
  const [reviewQuestions, setReviewQuestions] = useState(
    () => (storage && safely(() => loadReviewQuestions(storage))) ?? [],
  );
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [reviewDeleteErrors, setReviewDeleteErrors] = useState<Set<string>>(
    () => new Set(),
  );
  const tabRefs = useRef<Record<SubTab, HTMLButtonElement | null>>({
    quizzes: null,
    attempts: null,
    review: null,
  });

  const handleDeleteQuiz = (quiz: QuizConfig) => {
    if (!window.confirm(`Are you sure you want to delete "${quiz.title}"?`)) {
      return;
    }
    if (storage) safely(() => deleteSavedQuiz(storage, quiz.id));
    setSavedQuizzes((list) => list.filter((q) => q.id !== quiz.id));
  };

  const handleDeleteAttempt = (id: string) => {
    if (
      !window.confirm('Are you sure you want to delete this attempt record?')
    ) {
      return;
    }
    if (storage) safely(() => deleteHistoryRecord(storage, id));
    setAttempts((list) => list.filter((a) => a.id !== id));
  };

  const handleClearAllAttempts = () => {
    if (
      !window.confirm(
        'Are you sure you want to clear ALL attempt history? This cannot be undone.',
      )
    ) {
      return;
    }
    if (storage) safely(() => clearHistory(storage));
    setAttempts([]);
  };

  const handleDeleteReviewQuestion = (id: string): boolean => {
    if (!storage) return false;
    const deleted = safely(() => {
      deleteReviewQuestion(storage, id);
      return true;
    });
    if (!deleted) return false;
    setReviewQuestions((list) => list.filter((item) => item.id !== id));
    setSelectedReviewIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
    setReviewDeleteErrors((errors) => {
      const next = new Set(errors);
      next.delete(id);
      return next;
    });
    return true;
  };

  const toggleReviewSelection = (id: string, selected: boolean) => {
    setSelectedReviewIds((current) => {
      const next = new Set(current);
      if (selected && next.size < 15) next.add(id);
      else if (!selected) next.delete(id);
      return next;
    });
  };

  const handleStartReviewTest = () => {
    const selected = reviewQuestions.filter((item) =>
      selectedReviewIds.has(item.id),
    );
    if (selected.length > 0) onCreateReviewTest?.(selected);
  };

  // Arrow keys move between the three tabs, as in the ARIA tabs pattern.
  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const tabs: SubTab[] = ['quizzes', 'attempts', 'review'];
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next =
      tabs[(tabs.indexOf(subTab) + offset + tabs.length) % tabs.length];
    setSubTab(next);
    tabRefs.current[next]?.focus();
  };

  const tabProps = (id: SubTab) => ({
    ref: (el: HTMLButtonElement | null) => {
      tabRefs.current[id] = el;
    },
    id: `tab-${id}`,
    type: 'button' as const,
    role: 'tab',
    'aria-selected': subTab === id,
    'aria-controls': `panel-${id}`,
    tabIndex: subTab === id ? 0 : -1,
    onClick: () => setSubTab(id),
    className: tabClass(subTab === id),
  });

  return (
    <div className="w-full max-w-[1150px] mx-auto p-6 space-y-8 font-sans animate-fade-in">
      <div className="border-b border-gray-200 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Saved Quiz Library & History
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage your mock tests, view past score history, re-take quizzes, or
            export JSON files.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCreate}
            className="px-4 py-2.5 bg-[#006fbf] hover:bg-[#005694] text-white rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle aria-hidden="true" className="w-4 h-4" /> Create New
            Test
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div
          role="tablist"
          aria-label="Library"
          onKeyDown={onTabKey}
          className="flex items-center gap-2"
        >
          <button {...tabProps('quizzes')}>
            <FileJson aria-hidden="true" className="w-4 h-4" /> Saved Tests (
            {savedQuizzes.length})
          </button>
          <button {...tabProps('attempts')}>
            <History aria-hidden="true" className="w-4 h-4" /> Attempt History (
            {attempts.length})
          </button>
          <button {...tabProps('review')}>
            <Save aria-hidden="true" className="w-4 h-4" /> Review (
            {reviewQuestions.length})
          </button>
        </div>

        {subTab === 'attempts' && attempts.length > 0 && (
          <button
            type="button"
            onClick={handleClearAllAttempts}
            className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Trash2 aria-hidden="true" className="w-3.5 h-3.5" /> Clear Attempt
            History
          </button>
        )}
      </div>

      <div
        role="tabpanel"
        id={`panel-${subTab}`}
        aria-labelledby={`tab-${subTab}`}
      >
        {subTab === 'quizzes' &&
          (savedQuizzes.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-[#006fbf] text-white rounded-full flex items-center justify-center mx-auto">
                <FileJson aria-hidden="true" className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                No Saved Quizzes Found
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                You haven&apos;t saved any quizzes yet. Use the Test Creator to
                generate AI prompts or import JSON mock tests.
              </p>
              <button
                type="button"
                onClick={onCreate}
                className="px-6 py-2.5 bg-[#006fbf] hover:bg-[#005694] text-white font-bold text-sm rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <PlusCircle aria-hidden="true" className="w-4 h-4" /> Create
                Your First Test
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedQuizzes.map((quiz) => (
                <article
                  key={quiz.id}
                  aria-labelledby={`saved-${quiz.id}`}
                  className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-[#006fbf] text-white rounded text-xs font-mono font-bold">
                        {quiz.courseCode || 'GENERAL'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(quiz)}
                        aria-label={`Delete ${quiz.title}`}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                        title="Delete quiz"
                      >
                        <Trash2 aria-hidden="true" className="w-4 h-4" />
                      </button>
                    </div>

                    <h3
                      id={`saved-${quiz.id}`}
                      className="text-lg font-bold text-gray-900 leading-snug line-clamp-2"
                    >
                      {quiz.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 font-medium">
                        <HelpCircle
                          aria-hidden="true"
                          className="w-4 h-4 text-gray-400"
                        />
                        <span>{quiz.questions.length} Questions</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock
                          aria-hidden="true"
                          className="w-4 h-4 text-gray-400"
                        />
                        <span>{quiz.timeLimitMinutes} Minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onStart(quiz)}
                      className="flex-1 px-4 py-2 bg-[#006fbf] hover:bg-[#005694] text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Play
                        aria-hidden="true"
                        className="w-3.5 h-3.5 fill-current"
                      />{' '}
                      Start Quiz
                    </button>
                    <button
                      type="button"
                      onClick={() => exportJson(quiz)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Export JSON file"
                    >
                      <Download aria-hidden="true" className="w-3.5 h-3.5" />{' '}
                      Export
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ))}

        {subTab === 'attempts' &&
          (attempts.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500 text-gray-900 rounded-full flex items-center justify-center mx-auto">
                <History aria-hidden="true" className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                No Attempt History Recorded
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Complete a mock quiz attempt to automatically track your scores,
                completion time, and answer breakdowns.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {attempts.map((rec) => (
                <li
                  key={rec.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#006fbf] text-white rounded font-mono font-bold text-xs">
                        {rec.courseCode}
                      </span>
                      <time
                        dateTime={rec.timestamp}
                        className="text-xs text-gray-400 font-mono"
                      >
                        {new Date(rec.timestamp).toLocaleString()}
                      </time>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">
                      {rec.quizTitle}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock
                          aria-hidden="true"
                          className="w-3.5 h-3.5 text-gray-400"
                        />{' '}
                        {formatDuration(rec.timeTakenSeconds)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HelpCircle
                          aria-hidden="true"
                          className="w-3.5 h-3.5 text-gray-400"
                        />{' '}
                        {rec.quizSnapshot.questions.length} Questions
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 justify-between md:justify-end">
                    <div className="text-right">
                      <div className="text-2xl font-black text-gray-900 flex items-center gap-1.5 justify-end">
                        <span>
                          {rec.earnedScore}/{rec.totalPoints}
                        </span>{' '}
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            rec.percentage >= 80
                              ? 'bg-green-600 text-white'
                              : rec.percentage >= 60
                                ? 'bg-amber-500 text-gray-900'
                                : 'bg-red-600 text-white'
                          }`}
                        >
                          {Math.round(rec.percentage)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        Final Attempt Score
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onReview && (
                        <button
                          type="button"
                          onClick={() => onReview(rec)}
                          className="px-3.5 py-2 bg-white hover:bg-[#006fbf] text-[#006fbf] hover:text-white border border-[#006fbf] font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye aria-hidden="true" className="w-3.5 h-3.5" />{' '}
                          Review
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAttempt(rec.id)}
                        aria-label="Delete attempt"
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-gray-100 cursor-pointer"
                        title="Delete attempt log"
                      >
                        <Trash2 aria-hidden="true" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {subTab === 'review' && (
          <section aria-labelledby="review-list-title" className="space-y-5">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="review-list-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Questions to review
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Saved only in this browser. The most frequently missed
                  questions appear first.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartReviewTest}
                disabled={selectedReviewIds.size === 0 || !onCreateReviewTest}
                className="rounded-lg bg-[#006fbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#005694] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Create review test ({selectedReviewIds.size}/15)
              </button>
            </div>

            {reviewQuestions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <h3 className="text-lg font-bold text-gray-900">
                  No questions saved yet
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  From quiz results, choose “Save for review” on a question you
                  missed.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {[...reviewQuestions]
                  .sort((a, b) => b.timesWrong - a.timesWrong)
                  .map((saved) => {
                    const isSelected = selectedReviewIds.has(saved.id);
                    const correctIds = Array.isArray(
                      saved.question.correctAnswer,
                    )
                      ? saved.question.correctAnswer
                      : [saved.question.correctAnswer];
                    const correctAnswers = saved.question.options
                      ? saved.question.options
                          .filter((option) => correctIds.includes(option.id))
                          .map((option) => option.text)
                      : correctIds;
                    const wrongAnswers = Array.isArray(saved.wrongAnswer)
                      ? saved.wrongAnswer
                      : [saved.wrongAnswer];
                    const wrongAnswer = wrongAnswers
                      .map(
                        (answer) =>
                          saved.question.options?.find(
                            (option) => option.id === answer,
                          )?.text ?? answer,
                      )
                      .join(', ');

                    return (
                      <li
                        key={saved.id}
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={
                                !isSelected && selectedReviewIds.size >= 15
                              }
                              onChange={(event) =>
                                toggleReviewSelection(
                                  saved.id,
                                  event.target.checked,
                                )
                              }
                              aria-label={`Include question ${saved.question.number} in review test`}
                              className="mt-1"
                            />
                            <span>
                              <span className="block text-xs font-semibold text-gray-500">
                                {saved.courseCode} · {saved.quizTitle} ·
                                Question {saved.question.number}
                              </span>
                              <span className="mt-1 block font-semibold text-gray-900">
                                {saved.question.prompt}
                              </span>
                            </span>
                          </label>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800">
                              Wrong {saved.timesWrong}×
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!handleDeleteReviewQuestion(saved.id)) {
                                  setReviewDeleteErrors((errors) =>
                                    new Set(errors).add(saved.id),
                                  );
                                }
                              }}
                              aria-label={`Remove question ${saved.question.number} from review list`}
                              className="text-sm font-semibold text-gray-500 underline hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        {reviewDeleteErrors.has(saved.id) && (
                          <p
                            role="alert"
                            className="ml-7 mt-2 text-xs text-red-700"
                          >
                            Could not remove this question from browser storage.
                            Check that storage is available and try again.
                          </p>
                        )}
                        <details className="ml-7 mt-4 text-sm">
                          <summary className="cursor-pointer font-semibold text-[#006fbf]">
                            Show answers and explanation
                          </summary>
                          {saved.question.options && (
                            <ul className="mt-2 list-inside list-disc space-y-1 text-gray-700">
                              {saved.question.options.map((option) => (
                                <li key={option.id}>{option.text}</li>
                              ))}
                            </ul>
                          )}
                          <p className="mt-2 text-gray-700">
                            <strong>Right answer:</strong>{' '}
                            {correctAnswers.join(', ')}
                          </p>
                          <p className="mt-1 text-gray-700">
                            <strong>Your answer:</strong>{' '}
                            {wrongAnswer || 'No answer'}
                          </p>
                          {saved.question.explanation && (
                            <p className="mt-1 text-gray-700">
                              <strong>Explanation:</strong>{' '}
                              {saved.question.explanation}
                            </p>
                          )}
                        </details>
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
