import React, { useRef, useState, type KeyboardEvent } from 'react';
import {
  Clock,
  Eye,
  FileJson,
  HelpCircle,
  History,
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
import { EmptyState } from '../library/EmptyState';
import { QuizCard, cardGrid } from '../library/QuizCard';

export interface QuizHistoryProps {
  onStart: (quiz: QuizConfig) => void;
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
            <EmptyState
              icon={<FileJson aria-hidden="true" className="w-8 h-8" />}
              title="No Saved Quizzes Found"
              text="You haven't saved any quizzes yet. Use the Test Creator to generate AI prompts or import JSON mock tests."
            >
              <button
                type="button"
                onClick={onCreate}
                className="px-6 py-2.5 bg-[#006fbf] hover:bg-[#005694] text-white font-bold text-sm rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <PlusCircle aria-hidden="true" className="w-4 h-4" /> Create
                Your First Test
              </button>
            </EmptyState>
          ) : (
            <div className={cardGrid}>
              {savedQuizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  onStart={onStart}
                  onDelete={handleDeleteQuiz}
                />
              ))}
            </div>
          ))}

        {subTab === 'attempts' &&
          (attempts.length === 0 ? (
            <EmptyState
              icon={<History aria-hidden="true" className="w-8 h-8" />}
              iconClass="bg-amber-500 text-gray-900"
              title="No Attempt History Recorded"
              text="Complete a mock quiz attempt to automatically track your scores, completion time, and answer breakdowns."
            />
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
