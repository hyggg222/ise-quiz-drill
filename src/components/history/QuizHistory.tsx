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
  Trash2,
} from 'lucide-react';
import type { QuizAttemptRecord, QuizConfig } from '../../types/quiz';
import {
  clearHistory,
  deleteHistoryRecord,
  deleteSavedQuiz,
  loadHistory,
  loadSavedQuizzes,
} from '../../utils/attemptStorage';
import {
  browserStorage,
  safely,
  type KeyValueStore,
} from '../../utils/browserStorage';

export interface QuizHistoryProps {
  onStart: (quiz: QuizConfig, shuffleAnswers?: boolean) => void;
  onCreate: () => void;
  onReview?: (record: QuizAttemptRecord) => void;
  storage?: KeyValueStore;
}

type SubTab = 'quizzes' | 'attempts';

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
  storage = browserStorage(),
}) => {
  const [subTab, setSubTab] = useState<SubTab>('quizzes');
  const [savedQuizzes, setSavedQuizzes] = useState(
    () => (storage && safely(() => loadSavedQuizzes(storage))) ?? [],
  );
  const [attempts, setAttempts] = useState(
    () => (storage && safely(() => loadHistory(storage))) ?? [],
  );
  const [shuffleByQuiz, setShuffleByQuiz] = useState<Set<string>>(
    () => new Set(),
  );
  const tabRefs = useRef<Record<SubTab, HTMLButtonElement | null>>({
    quizzes: null,
    attempts: null,
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

  // Left and Right move between the two tabs, as in the ARIA tabs pattern
  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next: SubTab = subTab === 'quizzes' ? 'attempts' : 'quizzes';
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
                      onClick={() =>
                        onStart(quiz, shuffleByQuiz.has(quiz.id))
                      }
                      className="flex-1 px-4 py-2 bg-[#006fbf] hover:bg-[#005694] text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Play
                        aria-hidden="true"
                        className="w-3.5 h-3.5 fill-current"
                      />{' '}
                      Start Quiz
                    </button>
                    <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-gray-600">
                      <input
                        type="checkbox"
                        checked={shuffleByQuiz.has(quiz.id)}
                        onChange={(event) =>
                          setShuffleByQuiz((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(quiz.id);
                            else next.delete(quiz.id);
                            return next;
                          })
                        }
                      />
                      Shuffle answers
                    </label>
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
      </div>
    </div>
  );
};
