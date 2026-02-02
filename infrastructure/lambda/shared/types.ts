// Shared types between frontend and backend
// This is the single source of truth for domain types

export interface Question {
  id: string;
  topic: string;
  subtopic: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty: string;
  category?: string;
}

export interface TopicsMap {
  [topic: string]: string[];
}

export interface UserProgress {
  userId?: string;
  questionId: string;
  topic?: string;
  subtopic?: string;
  status: 'remind' | 'known' | 'wrong' | null;
  answeredCorrectly: boolean;
  wrongCount: number;
  correctCount: number;
  remindCount: number;
  knownCount: number;
  lastAnswered?: string;
  timestamp?: string;
}

export interface UserStats {
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  totalKnown: number;
  totalRemind: number;
  topicStats: Record<string, {
    answered: number;
    correct: number;
    wrong: number;
  }>;
}

export type QuizMode = 'smart' | 'wrong' | 'remind' | 'random' | 'notes';
export type ProgressStatus = 'known' | 'remind' | 'wrong';

// Notes types
export interface Note {
  noteId: string;
  userId?: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  quizMe: boolean;
  createdAt: string;
  updatedAt: string;
}
