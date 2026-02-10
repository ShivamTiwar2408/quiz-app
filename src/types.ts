// ============================================
// QUESTION TYPES
// ============================================

export interface Question {
  id: string;
  topic: string;
  subtopic: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  category?: string;
  tags?: string[];
  relatedConcepts?: string[];
}

export interface TopicsMap {
  [topic: string]: string[];
}

// ============================================
// SM-2 SPACED REPETITION TYPES
// ============================================

export interface SM2Data {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewDate: string;
}

export interface UserQuestionProgress {
  userId: string;
  questionId: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  sm2: SM2Data;
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  currentStreak: number;
  longestStreak: number;
  lastConfidenceRating: number;
  averageConfidenceRating: number;
  confidenceRatingsCount: number;
  averageResponseTimeMs: number;
  lastResponseTimeMs: number;
  userStatus: 'learning' | 'reviewing' | 'mastered' | 'struggling' | null;
  flaggedForReview: boolean;
  firstAttemptDate: string;
  lastAttemptDate: string;
  createdAt: string;
  updatedAt: string;
}

// Legacy UserProgress for backward compatibility
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

// ============================================
// QUIZ TYPES
// ============================================

export type QuizType = 
  | 'adaptive'
  | 'spaced_review'
  | 'topic_focused'
  | 'weak_area'
  | 'exam_prep'
  | 'random';

export type QuizMode = QuizType | 'smart' | 'wrong' | 'remind' | 'notes';

export interface QuizState {
  currentQuestionIndex: number;
  selectedAnswers: string[];
  showResult: boolean;
  score: number;
  answers: { questionId: string; selected: string[]; correct: boolean }[];
}

export interface QuizSession {
  sessionId: string;
  quizType: QuizType;
  questions: Question[];
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  startedAt: string;
}

// ============================================
// USER STATS
// ============================================

export interface TopicStat {
  topic: string;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  masteredCount: number;
  strugglingCount: number;
  averageConfidence: number;
  lastStudiedAt: string;
}

export interface UserStats {
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  totalKnown: number;
  totalRemind: number;
  topicStats: Record<string, { answered: number; correct: number; wrong: number }>;
  // SM-2 enhanced stats
  learningCount?: number;
  reviewingCount?: number;
  masteredCount?: number;
  strugglingCount?: number;
  overdueCount?: number;
  dueToday?: number;
  currentDailyStreak?: number;
  longestDailyStreak?: number;
}

// ============================================
// API TYPES
// ============================================

export interface GenerateQuizRequest {
  quizType: QuizType;
  count?: number;
  topic?: string;
  subtopic?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

export interface GenerateQuizResponse {
  sessionId: string;
  questions: Question[];
  quizType: QuizType;
  estimatedTimeMinutes: number;
  metadata: {
    overdueCount: number;
    newCount: number;
    reviewCount: number;
    difficultyDistribution: Record<string, number>;
  };
}

export interface SubmitAnswerRequest {
  sessionId: string;
  questionId: string;
  selectedAnswers: string[];
  confidenceRating: number;
  responseTimeMs: number;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctAnswers: string[];
  explanation: string;
  nextReviewDate: string;
  newInterval: number;
  newEaseFactor: number;
  newStatus: 'learning' | 'reviewing' | 'mastered' | 'struggling';
  streakUpdate: {
    currentStreak: number;
    isNewRecord: boolean;
  };
  relatedConcepts?: string[];
}

// ============================================
// AUTH TYPES
// ============================================

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

// ============================================
// NOTES TYPES
// ============================================

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
