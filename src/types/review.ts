import type { Question } from './quiz';
import type { Answer } from '../utils/answers';

export interface SavedReviewQuestion {
  id: string;
  quizId: string;
  quizTitle: string;
  courseCode: string;
  question: Question;
  wrongAnswer: Answer;
  timesWrong: number;
}
