import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type {
  AttemptState,
  QuizAttemptRecord,
  Question,
  QuizConfig,
  QuizEventType,
} from '../../types/quiz';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useQuizTimer } from '../../hooks/useQuizTimer';
import { quizStarted, quizSubmitted, track } from '../../utils/analytics';
import { isAnswered, type Answer } from '../../utils/answers';
import { appendHistory } from '../../utils/attemptStorage';
import { gradeQuiz } from '../../utils/grading';
import { paginate } from '../../utils/pagination';
import { shuffleQuizAnswers } from '../../utils/shuffleAnswers';
import {
  browserStorage,
  safely,
  type KeyValueStore,
} from '../../utils/browserStorage';
import { HeaderBar } from './HeaderBar';
import { QuestionNavigator } from './QuestionNavigator';
import { QuestionRenderer } from './QuestionRenderer';
import { ResultsReview } from './ResultsReview';
import { SubmitModal } from './SubmitModal';

export interface QuizSimulatorProps {
  quiz: QuizConfig;
  onExit?: () => void;
  storage?: KeyValueStore;
}

// Warn when this many seconds are left, largest first
const WARNINGS: [number, string][] = [
  [300, 'Your work will be submitted in 5 minutes.'],
  [60, 'Your work will be submitted in 1 minute.'],
];

function newAttempt(quiz: QuizConfig): AttemptState {
  const now = Date.now();
  return {
    quizId: quiz.id,
    startedAt: new Date(now).toISOString(),
    deadline: now + quiz.timeLimitMinutes * 60_000,
    currentPage: 1,
    answers: {},
    flagged: {},
    eventLog: [],
  };
}

const PageBar: React.FC<{
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className: string;
}> = ({ page, totalPages, onChange, className }) => (
  <div className={`flex items-center justify-between ${className}`}>
    <div className="flex items-center gap-4">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className={`px-7 py-3 text-base font-bold rounded transition-colors ${
          page === 1
            ? 'bg-[#e3e8ee] text-[#556370] cursor-not-allowed'
            : 'bg-[#e3e8ee] text-[#1f2937] hover:bg-gray-300'
        }`}
      >
        Previous Page
      </button>
      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className={`px-8 py-3 text-base font-bold rounded text-white transition-colors ${
          page === totalPages
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-[#006fbf] hover:bg-[#005694]'
        }`}
      >
        Next Page
      </button>
    </div>
    <span className="text-xl font-normal text-gray-900 tracking-tight">
      Page {page} of {totalPages}
    </span>
  </div>
);

interface QuestionItemProps {
  question: Question;
  answer: Answer | undefined;
  isFlagged: boolean;
  onAnswerChange: (questionId: string, answer: Answer) => void;
  onToggleFlag: (questionId: string) => void;
}

// Memoised so that answering one question in scroll mode does not render
// the other questions (and their code blocks) again
const QuestionItem = React.memo(function QuestionItem({
  question,
  answer,
  isFlagged,
  onAnswerChange,
  onToggleFlag,
}: QuestionItemProps) {
  return (
    <div id={`question-${question.id}`}>
      <QuestionRenderer
        question={question}
        answer={answer}
        isFlagged={isFlagged}
        onAnswerChange={(ans) => onAnswerChange(question.id, ans)}
        onToggleFlag={() => onToggleFlag(question.id)}
      />
    </div>
  );
});

export const QuizSimulator: React.FC<QuizSimulatorProps> = ({
  quiz,
  onExit,
  storage = browserStorage(),
}) => {
  const [activeQuiz, setActiveQuiz] = useState(quiz);
  const { questions, totalPages } = useMemo(
    () => paginate(activeQuiz),
    [activeQuiz],
  );
  // An attempt lives in memory only: a new start or a reload is a new attempt
  const [state, setState] = useState<AttemptState>(() =>
    newAttempt(activeQuiz),
  );
  const [record, setRecord] = useState<QuizAttemptRecord | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [toastState, setToastState] = useState<{
    message: string | null;
    isExiting: boolean;
  }>({ message: null, isExiting: false });
  const [isTimerBlinking, setIsTimerBlinking] = useState(false);
  const submitted = record !== null;
  const submittedRef = useRef(false);
  const warned = useRef(new Set<number>());

  const showToast = (message: string) =>
    setToastState({ message, isExiting: false });

  // Submitting is an event, not a state update, so it runs once even under
  // StrictMode; the ref also stops a timer expiry and a click racing.
  const handleFinalSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const now = Date.now();
    const graded = gradeQuiz(activeQuiz, state.answers);
    const next: QuizAttemptRecord = {
      id: `attempt-${now}`,
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      courseCode: activeQuiz.courseCode || 'GENERAL',
      timestamp: new Date(now).toISOString(),
      earnedScore: graded.earnedScore,
      totalPoints: graded.totalPoints,
      percentage: graded.percentage,
      timeTakenSeconds: Math.min(
        activeQuiz.timeLimitMinutes * 60,
        Math.round((now - Date.parse(state.startedAt)) / 1000),
      ),
      eventLog: state.eventLog,
      answers: state.answers,
      quizSnapshot: activeQuiz,
    };
    if (storage) safely(() => appendHistory(storage, next));
    track(quizSubmitted(activeQuiz, next.percentage, next.timeTakenSeconds));
    setIsSubmitModalOpen(false);
    setRecord(next);
    // Leave fullscreen so the results are read in the normal browser window
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const remainingSeconds = useQuizTimer({
    deadline: state.deadline,
    onExpire: handleFinalSubmit,
    running: !submitted,
  });

  // 5-minute and 1-minute warnings
  useEffect(() => {
    if (submitted || remainingSeconds === 0) return;
    const crossed = WARNINGS.filter(([seconds]) => remainingSeconds <= seconds);
    const latest = crossed[crossed.length - 1];
    if (!latest || warned.current.has(latest[0])) return;
    crossed.forEach(([seconds]) => warned.current.add(seconds));
    showToast(latest[1]);
    setIsTimerBlinking(true);
  }, [remainingSeconds, submitted]);

  useEffect(() => {
    if (!isTimerBlinking) return;
    const blinkTimer = setTimeout(() => setIsTimerBlinking(false), 5000);
    return () => clearTimeout(blinkTimer);
  }, [isTimerBlinking]);

  // The toast slides away after 10 seconds
  useEffect(() => {
    if (!toastState.message || toastState.isExiting) return;
    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    const dismissTimer = setTimeout(() => {
      setToastState((prev) => ({ ...prev, isExiting: true }));
      removeTimer = setTimeout(
        () => setToastState({ message: null, isExiting: false }),
        350,
      );
    }, 10_000);
    return () => {
      clearTimeout(dismissTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, [toastState.message, toastState.isExiting]);

  const logAntiCheatEvent = (type: QuizEventType, details: string) =>
    setState((prev) => ({
      ...prev,
      eventLog: [
        ...prev.eventLog,
        { type, timestamp: new Date().toISOString(), details },
      ],
    }));

  const antiCheat = useAntiCheat(activeQuiz.antiCheat, {
    active: !submitted,
    onEvent: logAntiCheatEvent,
    onNotice: showToast,
  });

  const handleRestartQuiz = (shuffleAnswers = false) => {
    const nextQuiz = shuffleAnswers
      ? shuffleQuizAnswers(activeQuiz)
      : activeQuiz;
    track(quizStarted(nextQuiz));
    submittedRef.current = false;
    warned.current.clear();
    setToastState({ message: null, isExiting: false });
    setIsTimerBlinking(false);
    setActiveQuiz(nextQuiz);
    setState(newAttempt(nextQuiz));
    setRecord(null);
  };

  const handleExit = () => {
    if (!window.confirm('Leave the quiz? Your answers will not be kept.')) {
      return;
    }
    if (onExit) onExit();
    else window.location.reload();
  };

  // Stable references, so memoised questions are not rendered again
  const handleAnswerChange = useCallback(
    (questionId: string, answer: Answer) =>
      setState((prev) => ({
        ...prev,
        answers: { ...prev.answers, [questionId]: answer },
      })),
    [],
  );
  const handleToggleFlag = useCallback(
    (questionId: string) =>
      setState((prev) => ({
        ...prev,
        flagged: { ...prev.flagged, [questionId]: !prev.flagged[questionId] },
      })),
    [],
  );

  if (record) {
    return (
      <ResultsReview
        quiz={activeQuiz}
        answers={record.answers}
        timeTakenSeconds={record.timeTakenSeconds}
        eventLog={record.eventLog}
        onRetake={handleRestartQuiz}
        onExit={onExit}
      />
    );
  }

  const templateMode = activeQuiz.templateMode;
  const currentPage = state.currentPage;
  const currentQuestions =
    templateMode === 'paginated'
      ? questions.filter((q) => q.page === currentPage)
      : questions;
  const answeredCount = questions.filter((q) =>
    isAnswered(state.answers[q.id]),
  ).length;
  const isAllAnswered =
    answeredCount === questions.length && questions.length > 0;

  const setCurrentPage = (page: number) =>
    setState((prev) => ({ ...prev, currentPage: page }));
  return (
    <div className="fixed inset-0 z-50 h-screen w-screen bg-white text-gray-900 flex flex-col items-center font-sans select-none overflow-hidden">
      {/* Full-width green accent line */}
      <div
        aria-hidden="true"
        className="w-full h-[4px] bg-[#008000] flex-shrink-0 z-50"
      />

      {antiCheat.needsFullscreen && (
        <div className="fixed inset-0 z-[100] h-screen w-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="fullscreen-title"
            className="bg-white border-2 border-red-500 rounded-xl max-w-xl w-full p-10 shadow-2xl"
          >
            <AlertTriangle
              aria-hidden="true"
              className="w-16 h-16 text-red-500 mx-auto mb-6"
            />
            <h2
              id="fullscreen-title"
              className="text-3xl font-extrabold text-gray-900 mb-4"
            >
              Fullscreen Required
            </h2>
            <p className="text-gray-700 font-medium text-lg leading-relaxed mb-10">
              This exam requires Proctoring Fullscreen Mode. Exiting fullscreen
              activity is logged in the Audit Trail. Please return to fullscreen
              to resume
            </p>
            <button
              type="button"
              autoFocus
              onClick={antiCheat.requestFullscreen}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-10 py-4 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {antiCheat.alert && (
        <div className="fixed inset-0 z-[90] h-screen w-screen bg-black/60 flex flex-col items-center justify-center p-6">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="anticheat-title"
            aria-describedby="anticheat-message"
            className="bg-white rounded-xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="absolute top-0 left-0 w-full h-[6px] bg-amber-500"
            />
            <AlertTriangle
              aria-hidden="true"
              className="w-12 h-12 text-amber-500 mb-4"
            />
            <h3
              id="anticheat-title"
              className="text-2xl font-bold text-gray-900 mb-3"
            >
              {antiCheat.alert.title}
            </h3>
            <p
              id="anticheat-message"
              className="text-gray-700 font-medium text-base mb-8"
            >
              {antiCheat.alert.message}
            </p>
            <button
              type="button"
              autoFocus
              onClick={antiCheat.dismissAlert}
              className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold px-6 py-3 flex-1 rounded-lg transition-colors w-full cursor-pointer"
            >
              I Understand, Resume Test
            </button>
          </div>
        </div>
      )}

      {toastState.message && (
        <>
          <style>{`
            @keyframes toastSlideUp {
              0% { transform: translate(-50%, 60px); opacity: 0; }
              100% { transform: translate(-50%, 0); opacity: 1; }
            }
            @keyframes toastSlideDown {
              0% { transform: translate(-50%, 0); opacity: 1; }
              100% { transform: translate(-50%, 60px); opacity: 0; }
            }
          `}</style>
          <div
            role="status"
            className="fixed bottom-10 left-1/2 z-50 pointer-events-auto"
            style={{
              animation: toastState.isExiting
                ? 'toastSlideDown 0.35s ease-in forwards'
                : 'toastSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div className="bg-white rounded-xl border border-gray-300 shadow-2xl flex items-center min-w-[550px] max-w-[720px] overflow-hidden">
              <div
                aria-hidden="true"
                className="w-[10px] self-stretch bg-[#d96c00] flex-shrink-0"
              />
              <div className="flex-1 py-5 px-7 text-gray-900 text-xl font-medium leading-relaxed">
                {toastState.message}
              </div>
              <button
                type="button"
                onClick={() =>
                  setToastState({ message: null, isExiting: false })
                }
                className="p-5 text-gray-400 hover:text-gray-800 transition-colors cursor-pointer flex-shrink-0"
                aria-label="Close"
              >
                <X aria-hidden="true" className="w-7 h-7 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Centered container, max 1200px */}
      <div className="w-full max-w-[1200px] bg-white flex flex-col flex-1 overflow-hidden">
        <HeaderBar
          title={activeQuiz.title}
          isProctored={!!activeQuiz.antiCheat?.enabled}
          remainingSeconds={remainingSeconds}
          totalSeconds={activeQuiz.timeLimitMinutes * 60}
          isWarning={isTimerBlinking}
          onExit={handleExit}
        />

        <div className="flex flex-1 overflow-hidden min-h-0">
          <QuestionNavigator
            questions={questions}
            currentPage={currentPage}
            answers={state.answers}
            flagged={state.flagged}
            onSelect={(question) => {
              if (templateMode === 'paginated') {
                setCurrentPage(question.page);
              } else {
                document
                  .getElementById(`question-${question.id}`)
                  ?.scrollIntoView?.({ behavior: 'smooth' });
              }
            }}
          />

          <div className="flex-1 bg-white pt-6 pb-0 flex flex-col h-full overflow-hidden min-w-0">
            <main className="flex-1 overflow-y-auto pl-6 pr-8 w-full custom-scrollbar flex flex-col justify-between">
              <div className="max-w-[780px] w-full flex flex-col justify-between min-h-full">
                <div>
                  {templateMode === 'paginated' && (
                    <PageBar
                      page={currentPage}
                      totalPages={totalPages}
                      onChange={setCurrentPage}
                      className="pb-4 mb-4"
                    />
                  )}

                  <div className="space-y-6">
                    {currentQuestions.map((q) => (
                      <QuestionItem
                        key={q.id}
                        question={q}
                        answer={state.answers[q.id]}
                        isFlagged={!!state.flagged[q.id]}
                        onAnswerChange={handleAnswerChange}
                        onToggleFlag={handleToggleFlag}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-2">
                  {templateMode === 'paginated' && (
                    <PageBar
                      page={currentPage}
                      totalPages={totalPages}
                      onChange={setCurrentPage}
                      className="mb-4"
                    />
                  )}

                  <div className="border-t border-gray-300 w-full my-5" />

                  <div className="flex items-center gap-8 pb-10">
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(true)}
                      className={`px-7 py-3 font-bold rounded text-base transition-colors cursor-pointer ${
                        isAllAnswered
                          ? 'bg-[#006fbf] hover:bg-[#005694] text-white shadow-sm'
                          : 'bg-[#e3e8ee] hover:bg-[#d5dde6] text-[#1f2937]'
                      }`}
                    >
                      Submit Quiz
                    </button>
                    <span className="text-lg italic text-gray-800 font-serif">
                      {answeredCount} of {questions.length} questions saved
                    </span>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      <SubmitModal
        isOpen={isSubmitModalOpen}
        questions={questions}
        answers={state.answers}
        onConfirm={handleFinalSubmit}
        onCancel={() => setIsSubmitModalOpen(false)}
      />
    </div>
  );
};
