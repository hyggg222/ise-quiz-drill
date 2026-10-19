import React, { useEffect, useState } from 'react';
import { Library, Wrench } from 'lucide-react';
import type { QuizAttemptRecord, QuizConfig } from '../../types/quiz';
import { quizStarted, track } from '../../utils/analytics';
import { loadSavedQuizzes, saveQuiz } from '../../utils/attemptStorage';
import { browserStorage, safely } from '../../utils/browserStorage';
import { shuffleQuizAnswers } from '../../utils/shuffleAnswers';
import { AppearanceSettings, type Theme } from './AppearanceSettings';
import { MockTestCreator } from '../creator/MockTestCreator';
import { QuizHistory } from '../history/QuizHistory';
import { QuizSimulator } from '../quiz/QuizSimulator';
import { ResultsReview } from '../quiz/ResultsReview';

type ViewMode = 'simulator' | 'creator' | 'history';
const THEME_STORAGE_KEY = 'quiz-drill-theme';

const loadTheme = (): Theme => {
  const storage = browserStorage();
  const savedTheme =
    storage && safely(() => storage.getItem(THEME_STORAGE_KEY));
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const navButton = (active: boolean) =>
  `px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
    active
      ? 'bg-[#006fbf] text-white shadow-xs'
      : 'text-slate-300 hover:text-white hover:bg-slate-700'
  }`;

export const AppContainer: React.FC = () => {
  const storage = browserStorage();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [viewMode, setViewMode] = useState<ViewMode>('creator');
  const [currentQuiz, setCurrentQuiz] = useState<QuizConfig | null>(null);
  const [reviewRecord, setReviewRecord] = useState<QuizAttemptRecord | null>(
    null,
  );
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => track({ event: 'app_opened' }), []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (storage) safely(() => storage.setItem(THEME_STORAGE_KEY, theme));
  }, [storage, theme]);

  // Refresh the saved quiz count whenever the view changes
  useEffect(() => {
    setSavedCount(
      (storage && safely(() => loadSavedQuizzes(storage).length)) ?? 0,
    );
  }, [viewMode, storage]);

  const handleStartQuiz = (quiz: QuizConfig, shuffleAnswers = false) => {
    const quizToStart = shuffleAnswers ? shuffleQuizAnswers(quiz) : quiz;
    track(quizStarted(quizToStart));
    setReviewRecord(null);
    setCurrentQuiz(quizToStart);
    setViewMode('simulator');
  };

  // A quiz started from the creator is kept in the library
  const handleStartFromCreator = (quiz: QuizConfig) => {
    if (storage) safely(() => saveQuiz(storage, quiz));
    handleStartQuiz(quiz);
  };

  const showView = (mode: ViewMode) => {
    setReviewRecord(null);
    setViewMode(mode);
  };

  if (reviewRecord) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white flex flex-col">
        <ResultsReview
          quiz={reviewRecord.quizSnapshot}
          answers={reviewRecord.answers}
          timeTakenSeconds={reviewRecord.timeTakenSeconds}
          eventLog={reviewRecord.eventLog}
          onRetake={(shuffleAnswers) =>
            handleStartQuiz(reviewRecord.quizSnapshot, shuffleAnswers)
          }
          onExit={() => showView('history')}
          theme={theme}
          onThemeChange={setTheme}
        />
      </div>
    );
  }

  if (viewMode === 'simulator' && currentQuiz) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-white flex flex-col">
        <QuizSimulator
          key={currentQuiz.id}
          quiz={currentQuiz}
          onExit={() => showView('creator')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans overflow-y-auto">
      <nav
        aria-label="Main"
        className="bg-[#1e293b] text-white px-8 py-3.5 flex items-center justify-between shadow-md z-40 select-none sticky top-0"
      >
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">Quiz Drill</span>

          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              aria-current={viewMode === 'creator' ? 'page' : undefined}
              onClick={() => showView('creator')}
              className={navButton(viewMode === 'creator')}
            >
              <Wrench aria-hidden="true" className="w-3.5 h-3.5" /> Test Creator
            </button>
            <button
              type="button"
              aria-current={viewMode === 'history' ? 'page' : undefined}
              onClick={() => showView('history')}
              className={navButton(viewMode === 'history')}
            >
              <Library aria-hidden="true" className="w-3.5 h-3.5" /> Saved
              Library
              {savedCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    viewMode === 'history'
                      ? 'bg-white text-[#006fbf]'
                      : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  <span className="sr-only">, </span>
                  {savedCount}
                  <span className="sr-only"> saved</span>
                </span>
              )}
            </button>
          </div>
          <AppearanceSettings theme={theme} onChange={setTheme} darkHeader />
        </div>
      </nav>

      <main className="flex-1 py-8 px-4">
        {viewMode === 'creator' && (
          <MockTestCreator onStart={handleStartFromCreator} />
        )}
        {viewMode === 'history' && (
          <QuizHistory
            onStart={handleStartQuiz}
            onCreate={() => showView('creator')}
            onReview={setReviewRecord}
          />
        )}
      </main>
    </div>
  );
};
