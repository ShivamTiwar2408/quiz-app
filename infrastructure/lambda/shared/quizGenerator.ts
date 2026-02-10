// Quiz Generation Logic with 5 Intelligent Quiz Types
// Implements adaptive difficulty, spaced repetition, topic-focused, weak area, and exam prep modes

import { Question, UserQuestionProgress, QuizType, GenerateQuizRequest } from './types';
import { QUIZ_CONFIG, PRIORITY_SCORING } from './constants';
import { calculatePriorityScore, isDueForReview, getDaysUntilReview } from './sm2';

interface QuestionWithScore {
  question: Question;
  score: number;
  progress?: UserQuestionProgress;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculate user's current accuracy for adaptive difficulty
 */
function calculateUserAccuracy(progressMap: Map<string, UserQuestionProgress>): number {
  const progressArray = Array.from(progressMap.values());
  if (progressArray.length === 0) return 0.5; // Default for new users
  
  const totalAttempts = progressArray.reduce((sum, p) => sum + p.totalAttempts, 0);
  const totalCorrect = progressArray.reduce((sum, p) => sum + p.correctAttempts, 0);
  
  if (totalAttempts === 0) return 0.5;
  return totalCorrect / totalAttempts;
}

/**
 * Get questions due for review (overdue + due today)
 */
function getDueQuestions(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>
): QuestionWithScore[] {
  const dueQuestions: QuestionWithScore[] = [];
  
  for (const question of questions) {
    const progress = progressMap.get(question.id);
    if (progress && isDueForReview(progress.sm2.nextReviewDate)) {
      dueQuestions.push({
        question,
        score: calculatePriorityScore(progress),
        progress,
      });
    }
  }
  
  // Sort by priority score (highest first)
  return dueQuestions.sort((a, b) => b.score - a.score);
}

/**
 * Get new questions (never attempted)
 */
function getNewQuestions(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>
): Question[] {
  return questions.filter(q => !progressMap.has(q.id));
}

/**
 * Get struggling questions (below 60% accuracy)
 */
function getStrugglingQuestions(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>
): QuestionWithScore[] {
  const struggling: QuestionWithScore[] = [];
  
  for (const question of questions) {
    const progress = progressMap.get(question.id);
    if (progress && progress.userStatus === 'struggling') {
      struggling.push({
        question,
        score: calculatePriorityScore(progress),
        progress,
      });
    }
  }
  
  return struggling.sort((a, b) => b.score - a.score);
}

/**
 * ADAPTIVE DIFFICULTY MODE
 * Converges to 70-75% accuracy by selecting appropriate difficulty
 */
function generateAdaptiveQuiz(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>,
  count: number,
  topic?: string,
  subtopic?: string
): Question[] {
  // Filter by topic/subtopic if specified
  let filtered = [...questions];
  if (topic) filtered = filtered.filter(q => q.topic === topic);
  if (subtopic) filtered = filtered.filter(q => q.subtopic === subtopic);
  
  const userAccuracy = calculateUserAccuracy(progressMap);
  const targetAccuracy = (QUIZ_CONFIG.ADAPTIVE_TARGET_ACCURACY_MIN + QUIZ_CONFIG.ADAPTIVE_TARGET_ACCURACY_MAX) / 2;
  
  // Determine difficulty bias based on current accuracy
  let difficultyBias: 'easy' | 'medium' | 'hard';
  if (userAccuracy > QUIZ_CONFIG.ADAPTIVE_TARGET_ACCURACY_MAX) {
    difficultyBias = 'hard'; // User doing too well, increase difficulty
  } else if (userAccuracy < QUIZ_CONFIG.ADAPTIVE_TARGET_ACCURACY_MIN) {
    difficultyBias = 'easy'; // User struggling, decrease difficulty
  } else {
    difficultyBias = 'medium'; // In target range
  }
  
  // Score questions based on difficulty match and progress
  const scored: QuestionWithScore[] = filtered.map(question => {
    const progress = progressMap.get(question.id);
    let score = 50; // Base score
    
    // Difficulty matching
    if (question.difficulty === difficultyBias) {
      score += 30;
    } else if (
      (difficultyBias === 'medium' && question.difficulty !== 'hard') ||
      (difficultyBias === 'hard' && question.difficulty !== 'easy')
    ) {
      score += 15;
    }
    
    // Boost for due/overdue questions
    if (progress) {
      const daysUntil = getDaysUntilReview(progress.sm2.nextReviewDate);
      if (daysUntil <= 0) score += 40;
      else if (daysUntil <= 3) score += 20;
      
      // Boost for struggling
      if (progress.userStatus === 'struggling') score += 25;
    } else {
      // New question bonus
      score += 20;
    }
    
    // Randomness
    score += Math.random() * PRIORITY_SCORING.RANDOMNESS_FACTOR;
    
    return { question, score, progress };
  });
  
  // Sort and select top questions
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.question);
}

/**
 * SPACED REPETITION REVIEW MODE
 * Prioritizes overdue questions using SM-2 algorithm
 */
function generateSpacedReviewQuiz(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>,
  count: number,
  topic?: string,
  subtopic?: string
): Question[] {
  let filtered = [...questions];
  if (topic) filtered = filtered.filter(q => q.topic === topic);
  if (subtopic) filtered = filtered.filter(q => q.subtopic === subtopic);
  
  // Get due questions sorted by priority
  const dueQuestions = getDueQuestions(filtered, progressMap);
  const selected: Question[] = dueQuestions.slice(0, count).map(d => d.question);
  
  // If not enough due questions, add some new ones
  if (selected.length < count) {
    const newQuestions = getNewQuestions(filtered, progressMap);
    const shuffledNew = shuffleArray(newQuestions);
    const needed = count - selected.length;
    selected.push(...shuffledNew.slice(0, needed));
  }
  
  // If still not enough, add random reviewed questions
  if (selected.length < count) {
    const selectedIds = new Set(selected.map(q => q.id));
    const remaining = filtered.filter(q => !selectedIds.has(q.id));
    const shuffledRemaining = shuffleArray(remaining);
    selected.push(...shuffledRemaining.slice(0, count - selected.length));
  }
  
  return shuffleArray(selected);
}

/**
 * TOPIC-FOCUSED PRACTICE MODE
 * Mixed difficulty for well-rounded mastery (30% weak + 40% medium + 30% advanced)
 */
function generateTopicFocusedQuiz(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>,
  count: number,
  topic?: string,
  subtopic?: string
): Question[] {
  let filtered = [...questions];
  if (topic) filtered = filtered.filter(q => q.topic === topic);
  if (subtopic) filtered = filtered.filter(q => q.subtopic === subtopic);
  
  const distribution = QUIZ_CONFIG.TOPIC_FOCUSED_DISTRIBUTION;
  const weakCount = Math.round(count * distribution.weak);
  const mediumCount = Math.round(count * distribution.medium);
  const advancedCount = count - weakCount - mediumCount;
  
  const selected: Question[] = [];
  const usedIds = new Set<string>();
  
  // 1. Get weak/struggling questions
  const struggling = getStrugglingQuestions(filtered, progressMap);
  for (const item of struggling) {
    if (selected.length >= weakCount) break;
    if (!usedIds.has(item.question.id)) {
      selected.push(item.question);
      usedIds.add(item.question.id);
    }
  }
  
  // Fill weak slots with easy questions if not enough struggling
  if (selected.length < weakCount) {
    const easyQuestions = shuffleArray(filtered.filter(q => 
      q.difficulty === 'easy' && !usedIds.has(q.id)
    ));
    for (const q of easyQuestions) {
      if (selected.length >= weakCount) break;
      selected.push(q);
      usedIds.add(q.id);
    }
  }
  
  // 2. Get medium difficulty questions
  const mediumQuestions = shuffleArray(filtered.filter(q => 
    q.difficulty === 'medium' && !usedIds.has(q.id)
  ));
  for (const q of mediumQuestions) {
    if (selected.length >= weakCount + mediumCount) break;
    selected.push(q);
    usedIds.add(q.id);
  }
  
  // 3. Get advanced/hard questions
  const hardQuestions = shuffleArray(filtered.filter(q => 
    q.difficulty === 'hard' && !usedIds.has(q.id)
  ));
  for (const q of hardQuestions) {
    if (selected.length >= count) break;
    selected.push(q);
    usedIds.add(q.id);
  }
  
  // Fill remaining with any available questions
  if (selected.length < count) {
    const remaining = shuffleArray(filtered.filter(q => !usedIds.has(q.id)));
    selected.push(...remaining.slice(0, count - selected.length));
  }
  
  return shuffleArray(selected);
}

/**
 * WEAK AREA REMEDIATION MODE
 * Auto-detects struggling topics and targets them
 */
function generateWeakAreaQuiz(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>,
  count: number
): Question[] {
  // Find struggling topics
  const topicStats = new Map<string, { correct: number; total: number }>();
  
  for (const progress of progressMap.values()) {
    const stats = topicStats.get(progress.topic) || { correct: 0, total: 0 };
    stats.correct += progress.correctAttempts;
    stats.total += progress.totalAttempts;
    topicStats.set(progress.topic, stats);
  }
  
  // Identify weak topics (below 60% accuracy)
  const weakTopics: string[] = [];
  for (const [topic, stats] of topicStats) {
    if (stats.total >= 3) { // Minimum attempts
      const accuracy = stats.correct / stats.total;
      if (accuracy < QUIZ_CONFIG.STRUGGLING_THRESHOLD) {
        weakTopics.push(topic);
      }
    }
  }
  
  // If no weak topics identified, fall back to struggling questions
  if (weakTopics.length === 0) {
    const struggling = getStrugglingQuestions(questions, progressMap);
    if (struggling.length > 0) {
      return shuffleArray(struggling.slice(0, count).map(s => s.question));
    }
    // Fall back to adaptive
    return generateAdaptiveQuiz(questions, progressMap, count);
  }
  
  // Get questions from weak topics
  const weakTopicQuestions = questions.filter(q => weakTopics.includes(q.topic));
  
  // Score and prioritize
  const scored: QuestionWithScore[] = weakTopicQuestions.map(question => {
    const progress = progressMap.get(question.id);
    let score = 50;
    
    if (progress) {
      // Prioritize questions user got wrong
      if (progress.userStatus === 'struggling') score += 40;
      if (isDueForReview(progress.sm2.nextReviewDate)) score += 30;
    } else {
      // New questions in weak topics
      score += 20;
    }
    
    score += Math.random() * 15;
    return { question, score, progress };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.question);
}

/**
 * EXAM PREP MODE
 * Progressive difficulty with time pressure simulation
 */
function generateExamPrepQuiz(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>,
  count: number,
  topic?: string,
  subtopic?: string
): Question[] {
  let filtered = [...questions];
  if (topic) filtered = filtered.filter(q => q.topic === topic);
  if (subtopic) filtered = filtered.filter(q => q.subtopic === subtopic);
  
  // Progressive difficulty: start easy, end hard
  const easyCount = Math.round(count * 0.3);
  const mediumCount = Math.round(count * 0.4);
  const hardCount = count - easyCount - mediumCount;
  
  const selected: Question[] = [];
  const usedIds = new Set<string>();
  
  // Select easy questions first
  const easyQuestions = shuffleArray(filtered.filter(q => q.difficulty === 'easy'));
  for (const q of easyQuestions) {
    if (selected.length >= easyCount) break;
    selected.push(q);
    usedIds.add(q.id);
  }
  
  // Then medium
  const mediumQuestions = shuffleArray(filtered.filter(q => 
    q.difficulty === 'medium' && !usedIds.has(q.id)
  ));
  for (const q of mediumQuestions) {
    if (selected.length >= easyCount + mediumCount) break;
    selected.push(q);
    usedIds.add(q.id);
  }
  
  // Then hard
  const hardQuestions = shuffleArray(filtered.filter(q => 
    q.difficulty === 'hard' && !usedIds.has(q.id)
  ));
  for (const q of hardQuestions) {
    if (selected.length >= count) break;
    selected.push(q);
    usedIds.add(q.id);
  }
  
  // Fill remaining
  if (selected.length < count) {
    const remaining = shuffleArray(filtered.filter(q => !usedIds.has(q.id)));
    selected.push(...remaining.slice(0, count - selected.length));
  }
  
  // DON'T shuffle - keep progressive difficulty order
  return selected;
}

/**
 * RANDOM MODE
 * Simple random selection
 */
function generateRandomQuiz(
  questions: Question[],
  count: number,
  topic?: string,
  subtopic?: string
): Question[] {
  let filtered = [...questions];
  if (topic) filtered = filtered.filter(q => q.topic === topic);
  if (subtopic) filtered = filtered.filter(q => q.subtopic === subtopic);
  
  return shuffleArray(filtered).slice(0, count);
}

/**
 * Main quiz generation function
 */
export function generateQuiz(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>,
  request: GenerateQuizRequest
): {
  questions: Question[];
  metadata: {
    overdueCount: number;
    newCount: number;
    reviewCount: number;
    difficultyDistribution: Record<string, number>;
  };
} {
  const { quizType, count = QUIZ_CONFIG.DEFAULT_QUIZ_SIZE, topic, subtopic } = request;
  const finalCount = Math.min(Math.max(count, QUIZ_CONFIG.MIN_QUIZ_SIZE), QUIZ_CONFIG.MAX_QUIZ_SIZE);
  
  let selectedQuestions: Question[];
  
  switch (quizType) {
    case 'adaptive':
      selectedQuestions = generateAdaptiveQuiz(questions, progressMap, finalCount, topic, subtopic);
      break;
    case 'spaced_review':
      selectedQuestions = generateSpacedReviewQuiz(questions, progressMap, finalCount, topic, subtopic);
      break;
    case 'topic_focused':
      selectedQuestions = generateTopicFocusedQuiz(questions, progressMap, finalCount, topic, subtopic);
      break;
    case 'weak_area':
      selectedQuestions = generateWeakAreaQuiz(questions, progressMap, finalCount);
      break;
    case 'exam_prep':
      selectedQuestions = generateExamPrepQuiz(questions, progressMap, finalCount, topic, subtopic);
      break;
    case 'random':
    default:
      selectedQuestions = generateRandomQuiz(questions, finalCount, topic, subtopic);
      break;
  }
  
  // Calculate metadata
  let overdueCount = 0;
  let newCount = 0;
  let reviewCount = 0;
  const difficultyDistribution: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  
  for (const q of selectedQuestions) {
    // Difficulty distribution
    difficultyDistribution[q.difficulty] = (difficultyDistribution[q.difficulty] || 0) + 1;
    
    // Progress status
    const progress = progressMap.get(q.id);
    if (!progress) {
      newCount++;
    } else if (isDueForReview(progress.sm2.nextReviewDate)) {
      overdueCount++;
    } else {
      reviewCount++;
    }
  }
  
  return {
    questions: selectedQuestions,
    metadata: {
      overdueCount,
      newCount,
      reviewCount,
      difficultyDistribution,
    },
  };
}

/**
 * Legacy support: Convert old quiz modes to new types
 */
export function convertLegacyMode(mode: string): QuizType {
  switch (mode) {
    case 'smart':
      return 'adaptive';
    case 'wrong':
      return 'weak_area';
    case 'remind':
      return 'spaced_review';
    case 'random':
    default:
      return 'random';
  }
}
