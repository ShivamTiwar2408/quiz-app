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
