import {
  QuizAnswer,
  QuizCompletion,
  QuizNextQuestion,
  QuizPlayerQuestion,
  QuizSession,
} from '../models/quiz-gameplay.model';

export const session: QuizSession = {
  sessionId: 42,
  status: 'IN_PROGRESS',
  questionCount: 2,
  answeredCount: 0,
  score: 0,
};
export const question: QuizPlayerQuestion = {
  sessionQuestionId: 101,
  questionNumber: 0,
  sentenceReading: '😀がっこうへ',
  targetStart: 1,
  targetLength: 4,
  options: [
    { id: 401, text: '学校' },
    { id: 402, text: '学生' },
    { id: 403, text: '先生' },
    { id: 404, text: '大学' },
  ],
};
export const nextQuestion: QuizNextQuestion = { sessionId: 42, status: 'IN_PROGRESS', question };
export const answer: QuizAnswer = {
  sessionQuestionId: 101,
  correct: false,
  correctOptionId: 401,
  explanationEn: 'School',
  explanationVi: 'Trường học',
  score: 0,
  answeredCount: 1,
  remainingCount: 1,
};
export const completion: QuizCompletion = {
  sessionId: 42,
  status: 'COMPLETED',
  questionCount: 2,
  correctCount: 1,
  incorrectCount: 1,
  score: 1,
  completedAt: '2026-10-12T00:00:00',
};
