/**
 * Quiz Generation Strategies - Strategy Pattern Implementation
 * Each strategy encapsulates a specific quiz generation algorithm
 */

import { Question, UserQuestionProgress, QuizType } from './types';
import { QUIZ_CONFIG, PRIORITY_SCORING } from './sm2Constants';
import { calculatePriorityScore, isDueForReview, getDaysUntilReview } from './sm2';

// ============================================
// INTERFACES
// ============================================

export interface QuizGenerationContext {
  questions: Question[];
  progressMap: Map<string, UserQuestionProgress>;
  count: number;
  topic?: string;
  subtopic?: string;
}

export interface QuizStrategy {
  generate(context: QuizGenerationContext): Question[];
}

interface QuestionWithScore {
  question: Question;
  score: number;
  progress?: UserQuestionProgress;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function filterByTopicSubtopic(questions: Question[], topic?: string, subtopic?: string): Question[] {
  let filtered = [...questions];
  if (topic) filtered = filtered.filter(q => q.topic === topic);
  if (subtopic) filtered = filtered.filter(q => q.subtopic === subtopic);
  return filtered;
}

function calculateUserAccuracy(progressMap: Map<string, UserQuestionProgress>): number {
  const progressArray = Array.from(progressMap.values());
  if (progressArray.length === 0) return 0.5;
  
  const totalAttempts = progressArray.reduce((sum, p) => sum + p.totalAttempts, 0);
  const totalCorrect = progressArray.reduce((sum, p) => sum + p.correctAttempts, 0);
  
  if (totalAttempts === 0) return 0.5;
  return totalCorrect / totalAttempts;
}

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
  
  return dueQuestions.sort((a, b) => b.score - a.score);
}

function getNewQuestions(
  questions: Question[],
  progressMap: Map<string, UserQuestionProgress>
): Question[] {
  return questions.filter(q => !progressMap.has(q.id));
}

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

// ============================================
// STRATEGY IMPLEMENTATIONS
// ============================================

/**
 * Adaptive Strategy - Converges to 70-75% accuracy
 */
export class AdaptiveStrategy implements QuizStrategy {
  generate(context: QuizGenerationContext): Question[] {
    const { questions, progressMap, count, topic, subtopic } = context;
    const filtered = filterByTopicSubtopic(questions, topic, subtopic);
    
    const userAccuracy = calculateUserAccuracy(progressMap);
    
    let difficultyBias: 'easy' | 'medium' | 'hard';
    if (userAccuracy > QUIZ_CONFIG.ADAPTIVE_TARGET_ACCURACY_MAX) {
      difficultyBias = 'hard';
    } else if (userAccuracy < QUIZ_CONFIG.ADAPTIVE_TARGET_ACCURACY_MIN) {
      difficultyBias = 'easy';
    } else {
      difficultyBias = 'medium';
    }
    
    const scored: QuestionWithScore[] = filtered.map(question => {
      const progress = progressMap.get(question.id);
      let score = 50;
      
      if (question.difficulty === difficultyBias) {
        score += 30;
      } else if (
        (difficultyBias === 'medium' && question.difficulty !== 'hard') ||
        (difficultyBias === 'hard' && question.difficulty !== 'easy')
      ) {
        score += 15;
      }
      
      if (progress) {
        const daysUntil = getDaysUntilReview(progress.sm2.nextReviewDate);
        if (daysUntil <= 0) score += 40;
        else if (daysUntil <= 3) score += 20;
        if (progress.userStatus === 'struggling') score += 25;
      } else {
        score += 20;
      }
      
      score += Math.random() * PRIORITY_SCORING.RANDOMNESS_FACTOR;
      
      return { question, score, progress };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.question);
  }
}

/**
 * Spaced Review Strategy - Prioritizes overdue questions using SM-2
 */
export class SpacedReviewStrategy implements QuizStrategy {
  generate(context: QuizGenerationContext): Question[] {
    const { questions, progressMap, count, topic, subtopic } = context;
    const filtered = filterByTopicSubtopic(questions, topic, subtopic);
    
    const dueQuestions = getDueQuestions(filtered, progressMap);
    const selected: Question[] = dueQuestions.slice(0, count).map(d => d.question);
    
    if (selected.length < count) {
      const newQuestions = getNewQuestions(filtered, progressMap);
      const shuffledNew = shuffleArray(newQuestions);
      selected.push(...shuffledNew.slice(0, count - selected.length));
    }
    
    if (selected.length < count) {
      const selectedIds = new Set(selected.map(q => q.id));
      const remaining = filtered.filter(q => !selectedIds.has(q.id));
      selected.push(...shuffleArray(remaining).slice(0, count - selected.length));
    }
    
    return shuffleArray(selected);
  }
}

/**
 * Topic Focused Strategy - Mixed difficulty for well-rounded mastery
 */
export class TopicFocusedStrategy implements QuizStrategy {
  generate(context: QuizGenerationContext): Question[] {
    const { questions, progressMap, count, topic, subtopic } = context;
    const filtered = filterByTopicSubtopic(questions, topic, subtopic);
    
    const distribution = QUIZ_CONFIG.TOPIC_FOCUSED_DISTRIBUTION;
    const weakCount = Math.round(count * distribution.weak);
    const mediumCount = Math.round(count * distribution.medium);
    
    const selected: Question[] = [];
    const usedIds = new Set<string>();
    
    // Weak/struggling questions
    const struggling = getStrugglingQuestions(filtered, progressMap);
    for (const item of struggling) {
      if (selected.length >= weakCount) break;
      if (!usedIds.has(item.question.id)) {
        selected.push(item.question);
        usedIds.add(item.question.id);
      }
    }
    
    // Fill with easy questions
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
    
    // Medium difficulty
    const mediumQuestions = shuffleArray(filtered.filter(q => 
      q.difficulty === 'medium' && !usedIds.has(q.id)
    ));
    for (const q of mediumQuestions) {
      if (selected.length >= weakCount + mediumCount) break;
      selected.push(q);
      usedIds.add(q.id);
    }
    
    // Hard questions
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
    
    return shuffleArray(selected);
  }
}

/**
 * Weak Area Strategy - Auto-detects and targets struggling topics
 */
export class WeakAreaStrategy implements QuizStrategy {
  private adaptiveStrategy = new AdaptiveStrategy();
  
  generate(context: QuizGenerationContext): Question[] {
    const { questions, progressMap, count } = context;
    
    // Find struggling topics
    const topicStats = new Map<string, { correct: number; total: number }>();
    
    for (const progress of progressMap.values()) {
      const stats = topicStats.get(progress.topic) || { correct: 0, total: 0 };
      stats.correct += progress.correctAttempts;
      stats.total += progress.totalAttempts;
      topicStats.set(progress.topic, stats);
    }
    
    const weakTopics: string[] = [];
    for (const [topic, stats] of topicStats) {
      if (stats.total >= 3) {
        const accuracy = stats.correct / stats.total;
        if (accuracy < QUIZ_CONFIG.STRUGGLING_THRESHOLD) {
          weakTopics.push(topic);
        }
      }
    }
    
    if (weakTopics.length === 0) {
      const struggling = getStrugglingQuestions(questions, progressMap);
      if (struggling.length > 0) {
        return shuffleArray(struggling.slice(0, count).map(s => s.question));
      }
      return this.adaptiveStrategy.generate(context);
    }
    
    const weakTopicQuestions = questions.filter(q => weakTopics.includes(q.topic));
    
    const scored: QuestionWithScore[] = weakTopicQuestions.map(question => {
      const progress = progressMap.get(question.id);
      let score = 50;
      
      if (progress) {
        if (progress.userStatus === 'struggling') score += 40;
        if (isDueForReview(progress.sm2.nextReviewDate)) score += 30;
      } else {
        score += 20;
      }
      
      score += Math.random() * 15;
      return { question, score, progress };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.question);
  }
}

/**
 * Exam Prep Strategy - Progressive difficulty
 */
export class ExamPrepStrategy implements QuizStrategy {
  generate(context: QuizGenerationContext): Question[] {
    const { questions, count, topic, subtopic } = context;
    const filtered = filterByTopicSubtopic(questions, topic, subtopic);
    
    const easyCount = Math.round(count * 0.3);
    const mediumCount = Math.round(count * 0.4);
    
    const selected: Question[] = [];
    const usedIds = new Set<string>();
    
    // Easy first
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
    
    // Keep progressive order (don't shuffle)
    return selected;
  }
}

/**
 * Random Strategy - Simple random selection
 */
export class RandomStrategy implements QuizStrategy {
  generate(context: QuizGenerationContext): Question[] {
    const { questions, count, topic, subtopic } = context;
    const filtered = filterByTopicSubtopic(questions, topic, subtopic);
    return shuffleArray(filtered).slice(0, count);
  }
}

// ============================================
// STRATEGY FACTORY
// ============================================

const strategyMap: Record<QuizType, QuizStrategy> = {
  adaptive: new AdaptiveStrategy(),
  spaced_review: new SpacedReviewStrategy(),
  topic_focused: new TopicFocusedStrategy(),
  weak_area: new WeakAreaStrategy(),
  exam_prep: new ExamPrepStrategy(),
  random: new RandomStrategy(),
};

/**
 * Get the appropriate strategy for a quiz type
 */
export function getQuizStrategy(quizType: QuizType): QuizStrategy {
  return strategyMap[quizType] || strategyMap.random;
}

/**
 * Register a custom strategy (for extensibility)
 */
export function registerStrategy(quizType: QuizType, strategy: QuizStrategy): void {
  strategyMap[quizType] = strategy;
}
