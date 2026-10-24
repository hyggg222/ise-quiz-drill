import type { Question } from '../types/quiz';
import { easyToHardText, type PromptOptions } from './promptBuilder';

const rank = { easy: 0, medium: 1, hard: 2 };

// "question 3" or "questions 2, 3"
const named = (positions: number[]) =>
  `${positions.length === 1 ? 'question' : 'questions'} ${positions.join(', ')}`;

// Warning lines for a quiz that broke what its prompt asked for
export function checkImport(
  options: PromptOptions,
  quiz: { questions: Question[] },
): string[] {
  const warnings: string[] = [];
  const count = quiz.questions.length;
  if (count !== options.questionCount) {
    warnings.push(
      `Asked for ${options.questionCount} questions, got ${count}.`,
    );
  }
  const wrongType = quiz.questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !options.types.includes(q.type))
    .map(({ q, index }) => `question ${index + 1} (${q.type})`);
  if (wrongType.length > 0) {
    warnings.push(`Type not allowed: ${wrongType.join(', ')}.`);
  }
  if (!options.notes.includes(easyToHardText)) return warnings;

  const outOfOrder: number[] = [];
  const unrated: number[] = [];
  let prev = -1;
  quiz.questions.forEach((q, index) => {
    if (!q.difficulty) {
      unrated.push(index + 1);
      return;
    }
    if (rank[q.difficulty] < prev) outOfOrder.push(index + 1);
    prev = rank[q.difficulty];
  });
  if (outOfOrder.length > 0) {
    warnings.push(`Not in easy-to-hard order: ${named(outOfOrder)}.`);
  }
  if (unrated.length > 0) {
    const them = unrated.length === 1 ? 'its' : 'their';
    warnings.push(
      `No difficulty on ${named(unrated)}, so ${them} order cannot be checked.`,
    );
  }
  return warnings;
}
