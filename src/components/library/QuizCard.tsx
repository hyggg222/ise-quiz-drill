import React from 'react';
import { Clock, Download, HelpCircle, Play, Trash2 } from 'lucide-react';
import type { QuizConfig } from '../../types/quiz';

export interface QuizCardProps {
  quiz: QuizConfig;
  onStart: (quiz: QuizConfig) => void;
  // Only the Saved library can delete
  onDelete?: (quiz: QuizConfig) => void;
}

// The grid the Saved library and the Community library list their cards in
export const cardGrid = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

// Downloads the quiz as a JSON file named after its title
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

// The Saved library card, shared with the Community library
export const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  onStart,
  onDelete,
}) => (
  <article
    aria-labelledby={`card-${quiz.id}`}
    className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5"
  >
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-0.5 bg-[#006fbf] text-white rounded text-xs font-mono font-bold">
          {quiz.courseCode || 'GENERAL'}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(quiz)}
            aria-label={`Delete ${quiz.title}`}
            className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
            title="Delete quiz"
          >
            <Trash2 aria-hidden="true" className="w-4 h-4" />
          </button>
        )}
      </div>

      <h3
        id={`card-${quiz.id}`}
        className="text-lg font-bold text-gray-900 leading-snug line-clamp-2"
      >
        {quiz.title}
      </h3>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5 font-medium">
          <HelpCircle aria-hidden="true" className="w-4 h-4 text-gray-400" />
          <span>{quiz.questions.length} Questions</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <Clock aria-hidden="true" className="w-4 h-4 text-gray-400" />
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
        <Play aria-hidden="true" className="w-3.5 h-3.5 fill-current" /> Start
        Quiz
      </button>
      <button
        type="button"
        onClick={() => exportJson(quiz)}
        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        title="Export JSON file"
      >
        <Download aria-hidden="true" className="w-3.5 h-3.5" /> Export
      </button>
    </div>
  </article>
);
