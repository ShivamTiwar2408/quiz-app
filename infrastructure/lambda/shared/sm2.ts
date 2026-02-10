// SM-2 Spaced Repetition Algorithm Implementation
// Based on SuperMemo SM-2 with enhancements for confidence-based adjustment

import { SM2Data, UserQuestionProgress } from './types';
import { SM2_CONFIG, STATUS_THRESHOLDS } from './constants';

/**
 * Calculate the next review date and updated SM-2 parameters
 * based on the user's confidence rating (0-5 scale)
 * 
 * Confidence Rating Scale:
 * 0 - Complete blackout (couldn't recall anything)
 * 1 - Wrong answer but recognized the correct one
 * 2 - Wrong answer but was close
 * 3 - Correct answer with significant difficulty
 * 4 - Correct answer with some hesitation
 * 5 - Perfect recall
 */
export function calculateSM2Update(
  currentSM2: SM2Data | null,
  confidenceRating: number,
  isCorrect: boolean
): SM2Data {
  // Clamp confidence rating to valid range
  const rating = Math.max(0, Math.min(5, Math.round(confidenceRating)));
  
  // Initialize SM2 data if new question
  const current: SM2Data = currentSM2 || {
    easeFactor: SM2_CONFIG.INITIAL_EASE_FACTOR,
    interval: SM2_CONFIG.INITIAL_INTERVAL,
    repetitions: SM2_CONFIG.INITIAL_REPETITIONS,
    nextReviewDate: new Date().toISOString(),
    lastReviewDate: new Date().toISOString(),
  };
  
  let newEaseFactor = current.easeFactor;
  let newInterval = current.interval;
  let newRepetitions = current.repetitions;
  
  // If answer was wrong (rating 0-2), reset repetitions
  if (rating < 3) {
    newRepetitions = 0;
    newInterval = SM2_CONFIG.MIN_INTERVAL;
    
    // Decrease ease factor for wrong answers
    newEaseFactor = current.easeFactor + SM2_CONFIG.EASE_ADJUSTMENTS[rating];
  } else {
    // Correct answer (rating 3-5)
    newRepetitions = current.repetitions + 1;
    
    // Calculate new interval based on repetitions
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      // Standard SM-2 formula: I(n) = I(n-1) * EF
      newInterval = Math.round(current.interval * current.easeFactor);
    }
    
    // Apply interval multiplier based on confidence
    const multiplier = SM2_CONFIG.INTERVAL_MULTIPLIERS[rating];
    if (multiplier > 1) {
      newInterval = Math.round(newInterval * multiplier);
    }
    
    // Adjust ease factor based on confidence
    newEaseFactor = current.easeFactor + SM2_CONFIG.EASE_ADJUSTMENTS[rating];
  }
  
  // Clamp ease factor to valid range
  newEaseFactor = Math.max(
    SM2_CONFIG.MIN_EASE_FACTOR,
    Math.min(SM2_CONFIG.MAX_EASE_FACTOR, newEaseFactor)
  );
  
  // Clamp interval to valid range
  newInterval = Math.max(
    SM2_CONFIG.MIN_INTERVAL,
    Math.min(SM2_CONFIG.MAX_INTERVAL, newInterval)
  );
  
  // Calculate next review date
  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + newInterval);
  
  return {
    easeFactor: Math.round(newEaseFactor * 100) / 100, // Round to 2 decimal places
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate: nextReview.toISOString(),
    lastReviewDate: now.toISOString(),
  };
}

/**
 * Determine user status based on performance metrics
 */
export function determineUserStatus(
  progress: Partial<UserQuestionProgress>
): 'learning' | 'reviewing' | 'mastered' | 'struggling' {
  const totalAttempts = progress.totalAttempts || 0;
  const correctAttempts = progress.correctAttempts || 0;
  const currentStreak = progress.currentStreak || 0;
  
  // Not enough data yet
  if (totalAttempts < STATUS_THRESHOLDS.MIN_ATTEMPTS_FOR_STATUS) {
    return 'learning';
  }
  
  const accuracy = correctAttempts / totalAttempts;
  
  // Check for mastery (high accuracy + streak)
  if (
    accuracy >= STATUS_THRESHOLDS.MASTERED &&
    currentStreak >= STATUS_THRESHOLDS.MASTERY_STREAK_REQUIRED
  ) {
    return 'mastered';
  }
  
  // Check for struggling
  if (accuracy < STATUS_THRESHOLDS.STRUGGLING) {
    return 'struggling';
  }
  
  // Check for reviewing (good progress)
  if (accuracy >= STATUS_THRESHOLDS.REVIEWING) {
    return 'reviewing';
  }
  
  // Default to learning
  return 'learning';
}

/**
 * Calculate days until next review (negative = overdue)
 */
export function getDaysUntilReview(nextReviewDate: string): number {
  const now = new Date();
  const reviewDate = new Date(nextReviewDate);
  const diffMs = reviewDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a question is due for review
 */
export function isDueForReview(nextReviewDate: string): boolean {
  return getDaysUntilReview(nextReviewDate) <= 0;
}

/**
 * Calculate priority score for question selection
 * Higher score = higher priority for review
 */
export function calculatePriorityScore(
  progress: UserQuestionProgress,
  lastTopicSeen?: string
): number {
  let score = 0;
  
  // Base score from overdue status
  const daysUntilReview = getDaysUntilReview(progress.sm2.nextReviewDate);
  
  if (daysUntilReview < 0) {
    // Overdue - high priority
    const daysOverdue = Math.abs(daysUntilReview);
    score += 100 + Math.min(daysOverdue * 5, 150); // Cap at 250
  } else if (daysUntilReview === 0) {
    // Due today
    score += 80;
  } else if (daysUntilReview === 1) {
    // Due tomorrow
    score += 40;
  } else {
    // Not due yet
    score += Math.max(0, 20 - daysUntilReview);
  }
  
  // Boost for struggling questions
  if (progress.userStatus === 'struggling') {
    score += 50;
  }
  
  // Boost for flagged questions
  if (progress.flaggedForReview) {
    score += 40;
  }
  
  // Boost for low confidence
  if (progress.averageConfidenceRating < 3) {
    score += 25;
  }
  
  // Topic interleaving bonus
  if (lastTopicSeen && progress.topic !== lastTopicSeen) {
    score += 10;
  }
  
  // Add randomness to prevent same order
  score += Math.random() * 15;
  
  return score;
}

/**
 * Create initial progress record for a new question
 */
export function createInitialProgress(
  userId: string,
  questionId: string,
  topic: string,
  subtopic: string,
  difficulty: string
): UserQuestionProgress {
  const now = new Date().toISOString();
  
  return {
    userId,
    questionId,
    topic,
    subtopic,
    difficulty,
    
    sm2: {
      easeFactor: SM2_CONFIG.INITIAL_EASE_FACTOR,
      interval: SM2_CONFIG.INITIAL_INTERVAL,
      repetitions: SM2_CONFIG.INITIAL_REPETITIONS,
      nextReviewDate: now, // Due immediately for new questions
      lastReviewDate: now,
    },
    
    totalAttempts: 0,
    correctAttempts: 0,
    wrongAttempts: 0,
    currentStreak: 0,
    longestStreak: 0,
    
    lastConfidenceRating: 0,
    averageConfidenceRating: 0,
    confidenceRatingsCount: 0,
    
    averageResponseTimeMs: 0,
    lastResponseTimeMs: 0,
    
    userStatus: null,
    flaggedForReview: false,
    
    firstAttemptDate: '',
    lastAttemptDate: '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update progress after an attempt
 */
export function updateProgressAfterAttempt(
  currentProgress: UserQuestionProgress,
  isCorrect: boolean,
  confidenceRating: number,
  responseTimeMs: number
): UserQuestionProgress {
  const now = new Date().toISOString();
  
  // Update SM-2 data
  const newSM2 = calculateSM2Update(currentProgress.sm2, confidenceRating, isCorrect);
  
  // Update attempt counts
  const totalAttempts = currentProgress.totalAttempts + 1;
  const correctAttempts = currentProgress.correctAttempts + (isCorrect ? 1 : 0);
  const wrongAttempts = currentProgress.wrongAttempts + (isCorrect ? 0 : 1);
  
  // Update streak
  let currentStreak = isCorrect ? currentProgress.currentStreak + 1 : 0;
  const longestStreak = Math.max(currentProgress.longestStreak, currentStreak);
  
  // Update confidence average
  const confidenceRatingsCount = currentProgress.confidenceRatingsCount + 1;
  const averageConfidenceRating = 
    (currentProgress.averageConfidenceRating * currentProgress.confidenceRatingsCount + confidenceRating) 
    / confidenceRatingsCount;
  
  // Update response time average
  const averageResponseTimeMs = 
    currentProgress.totalAttempts === 0
      ? responseTimeMs
      : (currentProgress.averageResponseTimeMs * currentProgress.totalAttempts + responseTimeMs) 
        / totalAttempts;
  
  const updatedProgress: UserQuestionProgress = {
    ...currentProgress,
    sm2: newSM2,
    totalAttempts,
    correctAttempts,
    wrongAttempts,
    currentStreak,
    longestStreak,
    lastConfidenceRating: confidenceRating,
    averageConfidenceRating: Math.round(averageConfidenceRating * 100) / 100,
    confidenceRatingsCount,
    averageResponseTimeMs: Math.round(averageResponseTimeMs),
    lastResponseTimeMs: responseTimeMs,
    firstAttemptDate: currentProgress.firstAttemptDate || now,
    lastAttemptDate: now,
    updatedAt: now,
  };
  
  // Determine new status
  updatedProgress.userStatus = determineUserStatus(updatedProgress);
  
  return updatedProgress;
}
