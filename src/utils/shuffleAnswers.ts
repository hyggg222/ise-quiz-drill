import type { Question, QuizConfig } from '../types/quiz';

function shuffledOptions(question: Question, random: () => number): Question {
  if (!question.options || question.options.length < 2) {
    return question;
  }

  const options = [...question.options];
  if (question.type === 'true-false') {
    const trueIndex = options.findIndex(
      (option) => option.text.trim().toLowerCase() === 'true',
    );
    const falseIndex = options.findIndex(
      (option) => option.text.trim().toLowerCase() === 'false',
    );
    if (trueIndex > falseIndex && falseIndex >= 0) {
      [options[trueIndex], options[falseIndex]] = [
        options[falseIndex],
        options[trueIndex],
      ];
      return { ...question, options };
    }
    return question;
  }

  for (let index = options.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [options[index], options[other]] = [options[other], options[index]];
  }

  if (
    options.every((option, index) => option.id === question.options![index].id)
  ) {
    options.push(options.shift()!);
  }

  return { ...question, options };
}

export function shuffleQuizAnswers(
  quiz: QuizConfig,
  random: () => number = Math.random,
): QuizConfig {
  return {
    ...quiz,
    questions: quiz.questions.map((question) =>
      shuffledOptions(question, random),
    ),
  };
}
