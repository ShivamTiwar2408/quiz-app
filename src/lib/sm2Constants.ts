// Shared constants for Lambda functions

export const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-User-Id',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

// ============================================
// SM-2 ALGORITHM CONSTANTS
// ============================================

export const SM2_CONFIG = {
  // Initial values for new questions
  INITIAL_EASE_FACTOR: 2.5,
  INITIAL_INTERVAL: 1,
  INITIAL_REPETITIONS: 0,
  
  // Ease factor bounds
  MIN_EASE_FACTOR: 1.3,
  MAX_EASE_FACTOR: 2.5,
  
  // Interval bounds (days)
  MIN_INTERVAL: 1,
  MAX_INTERVAL: 365,
  
  // Ease factor adjustment based on confidence rating (0-5)
  // Rating 0-2: decrease ease factor (harder)
  // Rating 3: no change
  // Rating 4-5: increase ease factor (easier)
  EASE_ADJUSTMENTS: {
    0: -0.8,  // Complete blackout
    1: -0.54, // Wrong but recognized
    2: -0.32, // Wrong but close
    3: -0.14, // Correct with difficulty
    4: 0,     // Correct with hesitation
    5: 0.1,   // Perfect recall
  } as Record<number, number>,
  
  // Interval multipliers based on confidence
  INTERVAL_MULTIPLIERS: {
    0: 0,     // Reset to 1 day
    1: 0,     // Reset to 1 day
    2: 0,     // Reset to 1 day
    3: 1,     // Keep current interval
    4: 1,     // Normal progression
    5: 1.3,   // Bonus for perfect recall
  } as Record<number, number>,
} as const;

// ============================================
// QUIZ GENERATION CONSTANTS
// ============================================

export const QUIZ_CONFIG = {
  // Default questions per quiz
  DEFAULT_QUIZ_SIZE: 10,
  MAX_QUIZ_SIZE: 50,
  MIN_QUIZ_SIZE: 5,
  
  // Target accuracy for adaptive mode (70-75%)
  ADAPTIVE_TARGET_ACCURACY_MIN: 0.70,
  ADAPTIVE_TARGET_ACCURACY_MAX: 0.75,
  
  // Difficulty distribution for topic-focused mode
  TOPIC_FOCUSED_DISTRIBUTION: {
    weak: 0.30,    // 30% questions user struggles with
    medium: 0.40,  // 40% medium difficulty
    advanced: 0.30 // 30% advanced/new concepts
  },
  
  // Weak area detection threshold
  STRUGGLING_THRESHOLD: 0.60, // Below 60% accuracy = struggling
  MASTERED_THRESHOLD: 0.90,   // Above 90% accuracy = mastered
  
  // Overdue priority weights
  OVERDUE_WEIGHTS: {
    DAYS_OVERDUE_MULTIPLIER: 10,
    STRUGGLE_BONUS: 50,
    USER_FLAG_BONUS: 30,
    LOW_CONFIDENCE_BONUS: 20,
  },
  
  // Time pressure for exam prep (seconds per question)
  EXAM_PREP_TIME_PER_QUESTION: {
    easy: 60,
    medium: 90,
    hard: 120,
  },
} as const;

// ============================================
// RETENTION PRIORITY SCORING
// ============================================

export const PRIORITY_SCORING = {
  // Base scores by status
  BASE_SCORES: {
    overdue: 100,
    due_today: 80,
    learning: 60,
    new: 40,
    reviewing: 30,
    mastered: 10,
  },
  
  // Modifiers
  MODIFIERS: {
    // Days overdue (capped at 30)
    OVERDUE_PER_DAY: 5,
    MAX_OVERDUE_BONUS: 150,
    
    // Struggle level (based on accuracy)
    STRUGGLE_MULTIPLIER: 2.0,
    
    // User flags
    FLAGGED_FOR_REVIEW: 40,
    
    // Confidence calibration
    LOW_CONFIDENCE_BONUS: 25,
    OVERCONFIDENT_PENALTY: -10, // High confidence but wrong
    
    // Recency
    NOT_SEEN_7_DAYS: 15,
    NOT_SEEN_30_DAYS: 30,
    
    // Topic interleaving bonus
    DIFFERENT_TOPIC_BONUS: 10,
  },
  
  // Randomness to prevent same order
  RANDOMNESS_FACTOR: 15,
} as const;

// ============================================
// USER STATUS THRESHOLDS
// ============================================

export const STATUS_THRESHOLDS = {
  // Minimum attempts before status assignment
  MIN_ATTEMPTS_FOR_STATUS: 3,
  
  // Accuracy thresholds
  STRUGGLING: 0.60,
  LEARNING: 0.75,
  REVIEWING: 0.85,
  MASTERED: 0.90,
  
  // Streak thresholds
  MASTERY_STREAK_REQUIRED: 5,
  
  // Confidence calibration
  WELL_CALIBRATED_THRESHOLD: 0.15, // Difference between confidence and accuracy
} as const;

// ============================================
// ANALYTICS CONSTANTS
// ============================================

export const ANALYTICS_CONFIG = {
  // Retention tracking periods (days)
  RETENTION_PERIODS: [1, 3, 7, 14, 30, 60, 90],
  
  // Session timeout (minutes)
  SESSION_TIMEOUT_MINUTES: 30,
  
  // Daily streak grace period (hours)
  STREAK_GRACE_PERIOD_HOURS: 36,
  
  // Cache TTL (seconds)
  STATS_CACHE_TTL: 300, // 5 minutes
  QUESTIONS_CACHE_TTL: 3600, // 1 hour
} as const;

// ============================================
// LEGACY SCORING (for backward compatibility)
// ============================================

export const SMART_SCORING = {
  BASE_UNSEEN: 50,
  WRONG_BASE: 100,
  WRONG_MULTIPLIER: 10,
  REMIND_BASE: 80,
  REMIND_MULTIPLIER: 5,
  KNOWN_BASE: 10,
  DAYS_BOOST_7: 20,
  DAYS_BOOST_30: 30,
  RANDOMNESS_FACTOR: 20,
} as const;
