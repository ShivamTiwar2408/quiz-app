// Application constants - Single source of truth
export const QUESTIONS_PER_QUIZ = 10;
export const PASSING_SCORE_PERCENT = 70;

export const QUIZ_MODES = {
  SMART: 'smart',
  WRONG: 'wrong',
  REMIND: 'remind',
  RANDOM: 'random',
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
} as const;

export const AUTH_SCREENS = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  CONFIRM: 'confirm',
} as const;
