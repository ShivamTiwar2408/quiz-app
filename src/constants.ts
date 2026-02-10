// Application constants - Single source of truth
export const QUESTIONS_PER_QUIZ = 10;
export const PASSING_SCORE_PERCENT = 70;

// Legacy quiz modes (for backward compatibility)
export const QUIZ_MODES = {
  SMART: 'smart',
  WRONG: 'wrong',
  REMIND: 'remind',
  RANDOM: 'random',
  NOTES: 'notes',
} as const;

// New SM-2 Quiz Types
export const QUIZ_TYPES = {
  ADAPTIVE: 'adaptive',           // Converges to 70-75% accuracy
  SPACED_REVIEW: 'spaced_review', // SM-2 based, overdue questions
  TOPIC_FOCUSED: 'topic_focused', // Mixed difficulty for topic mastery
  WEAK_AREA: 'weak_area',         // Auto-detected struggling topics
  EXAM_PREP: 'exam_prep',         // Progressive difficulty with time pressure
  RANDOM: 'random',               // Random selection
} as const;

// Quiz type display info
export const QUIZ_TYPE_INFO = {
  adaptive: {
    name: 'Smart Quiz',
    description: 'Adapts to your skill level',
    icon: '🎯',
  },
  spaced_review: {
    name: 'Spaced Review',
    description: 'Questions due for review',
    icon: '📅',
  },
  topic_focused: {
    name: 'Topic Practice',
    description: 'Deep dive into a topic',
    icon: '📚',
  },
  weak_area: {
    name: 'Weak Areas',
    description: 'Focus on struggles',
    icon: '💪',
  },
  exam_prep: {
    name: 'Exam Prep',
    description: 'Timed challenge mode',
    icon: '⏱️',
  },
  random: {
    name: 'Random',
    description: 'Mix of everything',
    icon: '🎲',
  },
} as const;

export const PROGRESS_STATUS = {
  KNOWN: 'known',
  REMIND: 'remind',
  WRONG: 'wrong',
} as const;

export const SCREENS = {
  HOME: 'home',
  QUIZ: 'quiz',
  RESULTS: 'results',
  NOTES: 'notes',
} as const;

export const AUTH_SCREENS = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  CONFIRM: 'confirm',
} as const;

// SM-2 Confidence Scale
export const CONFIDENCE_SCALE = {
  BLACKOUT: 0,      // Complete blank
  WRONG: 1,         // Wrong but recognized after
  HARD: 2,          // Struggled significantly
  OKAY: 3,          // Correct with effort
  GOOD: 4,          // Correct with slight hesitation
  EASY: 5,          // Perfect instant recall
} as const;
