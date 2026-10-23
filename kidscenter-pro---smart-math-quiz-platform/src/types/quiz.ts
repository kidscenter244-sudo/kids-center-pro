export type OperationType = 'multiply' | 'divide' | 'mixed';

export interface QuestionGroup {
  id: string;
  operation: OperationType; // 'multiply' | 'divide' | 'mixed'
  num1Digits: number;       // e.g. 1 digit, 2 digits, 3 digits
  num2Digits: number;       // e.g. 1 digit, 2 digits
  questionCount: number;    // e.g. 10 questions
}

export interface QuizConfig {
  groups: QuestionGroup[];
  totalQuestionCount: number;
  timeMinutes: number; // 0 means unlimited
  allowScratchpad: boolean;
  divisionExactOnly: boolean;
  title?: string; // auto-generated
}

export interface Question {
  id: string;
  num1: number;
  num2: number;
  operator: string;
  operatorType: 'multiply' | 'divide';
  correctAnswer: number;
  groupId?: string;
  groupLabel?: string;
}

export interface Quiz {
  id: string;
  code: string;
  config: QuizConfig;
  questions: Question[];
  createdAt: string;
}

export interface StudentAnswer {
  questionId: string;
  questionText: string;
  correctAnswer: number;
  studentAnswer: number | null;
  isCorrect: boolean;
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  quizTitle: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  submittedAt: string;
  answers: StudentAnswer[];
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected?: boolean;
}
