import { QuizQuestionCreateRequest } from '../models/quiz-question.model';

export function quizImportFixture(): QuizQuestionCreateRequest {
  return {
    content: {
      sourceType: 'CUSTOM',
      sentenceReading: '\u{1F600}\u304b\u306a',
      targetStart: 1,
      targetLength: 2,
      targetReading: '\u304b\u306a',
      levelIds: [1],
      lessonIds: [2],
    },
    options: ['A', 'B', 'C', 'D'].map((text, index) => ({ text, correct: index === 0 })),
  };
}
