/**
 * Quiz Generation Logic with Strategy Pattern
 * Uses pluggable strategies for different quiz types
 */

import { Question, UserQuestionProgress, QuizType, GenerateQuizRequest } from './types';
import { QUIZ_CONFIG } from './sm2Constants';
import { isDueForReview } from './sm2';
import { getQuizStrategy, QuizGenerationContext } from './quizStrategies';

/**
 * Main quiz generation function using Strategy pattern
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
  
  // Get the appropriate strategy for this quiz type
  const strategy = getQuizStrategy(quizType);
  
  // Create context for the strategy
  const context: QuizGenerationContext = {
    questions,
    progressMap,
    count: finalCount,
    topic,
    subtopic,
  };
  
  // Generate questions using the strategy
  const selectedQuestions = strategy.generate(context);
  
  // Calculate metadata
  let overdueCount = 0;
  let newCount = 0;
  let reviewCount = 0;
  const difficultyDistribution: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  
  for (const q of selectedQuestions) {
    difficultyDistribution[q.difficulty] = (difficultyDistribution[q.difficulty] || 0) + 1;
    
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

// Re-export strategies for extensibility
export { getQuizStrategy, registerStrategy } from './quizStrategies';
export type { QuizStrategy, QuizGenerationContext } from './quizStrategies';
