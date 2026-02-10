// Enhanced SM-2 Spaced Repetition Types
// Single source of truth for domain types

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
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
  relatedConcepts?: string[]; // For topic interleaving
}

export interface TopicsMap {
  [topic: string]: string[];
}

// ============================================
// SM-2 SPACED REPETITION TYPES
// ============================================

export interface SM2Data {
  easeFactor: number;      // 1.3 - 2.5, default 2.5
  interval: number;        // Days until next review
  repetitions: number;     // Consecutive correct answers
  nextReviewDate: string;  // ISO date string
  lastReviewDate: string;  // ISO date string
}

export interface UserQuestionProgress {
  // Keys
  userId: string;
  questionId: string;
  
  // Question metadata (denormalized for queries)
  topic: string;
  subtopic: string;
  difficulty: string;
  
  // SM-2 Core Data
  sm2: SM2Data;
  
  // Performance Metrics
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  currentStreak: number;
  longestStreak: number;
  
  // Confidence & Self-Assessment
  lastConfidenceRating: number;  // 0-5 scale (user self-assessment)
  averageConfidenceRating: number;
  confidenceRatingsCount: number;
  
  // Response Time Analytics
  averageResponseTimeMs: number;
  lastResponseTimeMs: number;
  
  // User Flags
  userStatus: 'learning' | 'reviewing' | 'mastered' | 'struggling' | null;
  flaggedForReview: boolean;
  
  // Timestamps
  firstAttemptDate: string;
  lastAttemptDate: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// QUIZ ATTEMPT TRACKING
// ============================================

export interface QuizAttempt {
  attemptId: string;
  userId: string;
  questionId: string;
  
  // Attempt Details
  selectedAnswers: string[];
  correctAnswers: string[];
  isCorrect: boolean;
  
  // Self-Assessment (0-5 scale)
  // 0 = Complete blackout, 1 = Wrong but recognized, 2 = Wrong but close
  // 3 = Correct with difficulty, 4 = Correct with hesitation, 5 = Perfect recall
  confidenceRating: number;
  
  // Performance Metrics
  responseTimeMs: number;
  
  // Context
  quizType: QuizType;
  topic: string;
  subtopic: string;
  difficulty: string;
  
  // Timestamps
  attemptedAt: string;
}

// ============================================
// QUIZ TYPES & MODES
// ============================================

export type QuizType = 
  | 'adaptive'           // Converges to 70-75% accuracy
  | 'spaced_review'      // SM-2 based, overdue questions
  | 'topic_focused'      // Mixed difficulty for topic mastery
  | 'weak_area'          // Auto-detected struggling topics
  | 'exam_prep'          // Progressive difficulty with time pressure
  | 'random';            // Random selection

export type QuizMode = QuizType | 'smart' | 'wrong' | 'remind' | 'notes'; // Legacy support

// ============================================
// QUIZ SESSION
// ============================================

export interface QuizSession {
  sessionId: string;
  userId: string;
  quizType: QuizType;
  
  // Filter
  topic?: string;
  subtopic?: string;
  
  // Session Stats
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  
  // Timing
  startedAt: string;
  completedAt?: string;
  totalTimeMs?: number;
  
  // Questions in this session
  questionIds: string[];
  
  // Results
  accuracy?: number;
  averageConfidence?: number;
  averageResponseTimeMs?: number;
}

// ============================================
// USER ANALYTICS & STATS
// ============================================

export interface UserStats {
  userId: string;
  
  // Overall Progress
  totalQuestionsAttempted: number;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  overallAccuracy: number;
  
  // SM-2 Status Counts
  learningCount: number;      // New or relearning
  reviewingCount: number;     // In review cycle
  masteredCount: number;      // Well-learned
  strugglingCount: number;    // Below 60% accuracy
  
  // Due for Review
  overdueCount: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  
  // Streaks
  currentDailyStreak: number;
  longestDailyStreak: number;
  lastStudyDate: string;
  
  // Topic Stats
  topicStats: Record<string, TopicStat>;
  
  // Confidence Calibration
  averageConfidence: number;
  confidenceAccuracyCorrelation: number; // How well confidence predicts accuracy
  
  // Time Stats
  totalStudyTimeMs: number;
  averageSessionTimeMs: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

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

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface GenerateQuizRequest {
  quizType: QuizType;
  count?: number;
  topic?: string;
  subtopic?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  includeOverdue?: boolean;
  timeLimitMinutes?: number; // For exam prep mode
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
  confidenceRating: number; // 0-5
  responseTimeMs: number;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctAnswers: string[];
  explanation: string;
  
  // Updated SM-2 data
  nextReviewDate: string;
  newInterval: number;
  newEaseFactor: number;
  
  // Progress update
  newStatus: 'learning' | 'reviewing' | 'mastered' | 'struggling';
  streakUpdate: {
    currentStreak: number;
    isNewRecord: boolean;
  };
  
  // Related concepts for learning
  relatedConcepts?: string[];
}

export interface GetProgressResponse {
  progress: Record<string, UserQuestionProgress>;
  stats: UserStats;
  dueForReview: {
    overdue: string[];
    dueToday: string[];
    dueTomorrow: string[];
  };
}

// ============================================
// NOTES TYPES (Existing)
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

// ============================================
// LEGACY SUPPORT TYPES
// ============================================

export type ProgressStatus = 'known' | 'remind' | 'wrong';

// Legacy UserProgress for backward compatibility
export interface LegacyUserProgress {
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
