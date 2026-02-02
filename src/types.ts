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
}

export interface UserStats {
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  totalKnown: number;
  totalRemind: number;
  topicStats: Record<string, { answered: number; correct: number; wrong: number }>;
}

export interface QuizState {
  currentQuestionIndex: number;
  selectedAnswers: string[];
  showResult: boolean;
  score: number;
  answers: { questionId: string; selected: string[]; correct: boolean }[];
}

export type QuizMode = 'smart' | 'wrong' | 'remind' | 'random' | 'notes';

// Auth types
export interface AuthUser {
  email: string;
  userId: string;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

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
