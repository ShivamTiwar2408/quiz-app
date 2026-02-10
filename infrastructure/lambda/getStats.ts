// Get Stats Lambda - Detailed Analytics
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';
import { UserQuestionProgress, QuizAttempt } from './shared/types';
import { getDaysUntilReview } from './shared/sm2';

interface DetailedStats {
  // Overview
  totalQuestions: number;
  questionsAttempted: number;
  questionsNeverSeen: number;
  
  // Accuracy
  overallAccuracy: number;
  last7DaysAccuracy: number;
  last30DaysAccuracy: number;
  
  // SM-2 Status Distribution
  statusDistribution: {
    learning: number;
    reviewing: number;
    mastered: number;
    struggling: number;
    notStarted: number;
  };
  
  // Review Schedule
  reviewSchedule: {
    overdue: number;
    dueToday: number;
    dueTomorrow: number;
    dueThisWeek: number;
    dueNextWeek: number;
    dueLater: number;
  };
  
  // Difficulty Distribution
  difficultyStats: {
    easy: { attempted: number; accuracy: number };
    medium: { attempted: number; accuracy: number };
    hard: { attempted: number; accuracy: number };
  };
  
  // Topic Performance
  topicPerformance: Array<{
    topic: string;
    attempted: number;
    accuracy: number;
    mastered: number;
    struggling: number;
    overdue: number;
  }>;
  
  // Streaks
  streaks: {
    currentDaily: number;
    longestDaily: number;
    currentQuestion: number;
    longestQuestion: number;
  };
  
  // Confidence Calibration
  confidenceCalibration: {
    averageConfidence: number;
    actualAccuracy: number;
    calibrationScore: number; // How well confidence predicts accuracy
    isOverconfident: boolean;
    isUnderconfident: boolean;
  };
  
  // Time Stats
  timeStats: {
    averageResponseTimeMs: number;
    fastestResponseTimeMs: number;
    slowestResponseTimeMs: number;
  };
  
  // Recent Activity
  recentActivity: {
    lastStudyDate: string;
    questionsLast7Days: number;
    questionsLast30Days: number;
    studyDaysLast30: number;
  };
}

async function fetchProgress(userId: string): Promise<UserQuestionProgress[]> {
  const tableName = process.env.PROGRESS_TABLE;
  if (!tableName) return [];

  const docClient = getDocClient();
  const result = await docClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
  }));

  return (result.Items || []) as UserQuestionProgress[];
}

async function fetchRecentAttempts(userId: string, days: number): Promise<QuizAttempt[]> {
  const tableName = process.env.ATTEMPTS_TABLE;
  if (!tableName) return [];

  const docClient = getDocClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await docClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: 'attemptedAt >= :cutoff',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':cutoff': cutoffDate.toISOString(),
    },
  }));

  return (result.Items || []) as QuizAttempt[];
}

function calculateStats(
  progress: UserQuestionProgress[],
  recentAttempts: QuizAttempt[],
  totalQuestions: number
): DetailedStats {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Initialize stats
  const stats: DetailedStats = {
    totalQuestions,
    questionsAttempted: progress.length,
    questionsNeverSeen: totalQuestions - progress.length,
    overallAccuracy: 0,
    last7DaysAccuracy: 0,
    last30DaysAccuracy: 0,
    statusDistribution: {
      learning: 0,
      reviewing: 0,
      mastered: 0,
      struggling: 0,
      notStarted: totalQuestions - progress.length,
    },
    reviewSchedule: {
      overdue: 0,
      dueToday: 0,
      dueTomorrow: 0,
      dueThisWeek: 0,
      dueNextWeek: 0,
      dueLater: 0,
    },
    difficultyStats: {
      easy: { attempted: 0, accuracy: 0 },
      medium: { attempted: 0, accuracy: 0 },
      hard: { attempted: 0, accuracy: 0 },
    },
    topicPerformance: [],
    streaks: {
      currentDaily: 0,
      longestDaily: 0,
      currentQuestion: 0,
      longestQuestion: 0,
    },
    confidenceCalibration: {
      averageConfidence: 0,
      actualAccuracy: 0,
      calibrationScore: 0,
      isOverconfident: false,
      isUnderconfident: false,
    },
    timeStats: {
      averageResponseTimeMs: 0,
      fastestResponseTimeMs: Infinity,
      slowestResponseTimeMs: 0,
    },
    recentActivity: {
      lastStudyDate: '',
      questionsLast7Days: 0,
      questionsLast30Days: 0,
      studyDaysLast30: 0,
    },
  };

  // Topic aggregation
  const topicMap = new Map<string, {
    attempted: number;
    correct: number;
    wrong: number;
    mastered: number;
    struggling: number;
    overdue: number;
  }>();

  // Difficulty aggregation
  const difficultyMap = new Map<string, { correct: number; wrong: number }>();
  difficultyMap.set('easy', { correct: 0, wrong: 0 });
  difficultyMap.set('medium', { correct: 0, wrong: 0 });
  difficultyMap.set('hard', { correct: 0, wrong: 0 });

  let totalCorrect = 0;
  let totalWrong = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;
  let totalResponseTime = 0;
  let responseTimeCount = 0;
  let maxStreak = 0;
  let currentMaxStreak = 0;

  // Process progress data
  for (const p of progress) {
    // Status distribution
    if (p.userStatus === 'learning') stats.statusDistribution.learning++;
    else if (p.userStatus === 'reviewing') stats.statusDistribution.reviewing++;
    else if (p.userStatus === 'mastered') stats.statusDistribution.mastered++;
    else if (p.userStatus === 'struggling') stats.statusDistribution.struggling++;

    // Review schedule
    if (p.sm2?.nextReviewDate) {
      const daysUntil = getDaysUntilReview(p.sm2.nextReviewDate);
      if (daysUntil < 0) stats.reviewSchedule.overdue++;
      else if (daysUntil === 0) stats.reviewSchedule.dueToday++;
      else if (daysUntil === 1) stats.reviewSchedule.dueTomorrow++;
      else if (daysUntil <= 7) stats.reviewSchedule.dueThisWeek++;
      else if (daysUntil <= 14) stats.reviewSchedule.dueNextWeek++;
      else stats.reviewSchedule.dueLater++;
    }

    // Totals
    totalCorrect += p.correctAttempts;
    totalWrong += p.wrongAttempts;

    // Confidence
    if (p.confidenceRatingsCount > 0) {
      totalConfidence += p.averageConfidenceRating * p.confidenceRatingsCount;
      confidenceCount += p.confidenceRatingsCount;
    }

    // Response time
    if (p.averageResponseTimeMs > 0) {
      totalResponseTime += p.averageResponseTimeMs;
      responseTimeCount++;
      stats.timeStats.fastestResponseTimeMs = Math.min(stats.timeStats.fastestResponseTimeMs, p.averageResponseTimeMs);
      stats.timeStats.slowestResponseTimeMs = Math.max(stats.timeStats.slowestResponseTimeMs, p.averageResponseTimeMs);
    }

    // Streaks
    maxStreak = Math.max(maxStreak, p.longestStreak);
    currentMaxStreak = Math.max(currentMaxStreak, p.currentStreak);

    // Topic aggregation
    if (p.topic) {
      const topicStats = topicMap.get(p.topic) || {
        attempted: 0, correct: 0, wrong: 0, mastered: 0, struggling: 0, overdue: 0
      };
      topicStats.attempted++;
      topicStats.correct += p.correctAttempts;
      topicStats.wrong += p.wrongAttempts;
      if (p.userStatus === 'mastered') topicStats.mastered++;
      if (p.userStatus === 'struggling') topicStats.struggling++;
      if (p.sm2?.nextReviewDate && getDaysUntilReview(p.sm2.nextReviewDate) < 0) {
        topicStats.overdue++;
      }
      topicMap.set(p.topic, topicStats);
    }

    // Difficulty aggregation
    if (p.difficulty) {
      const diffStats = difficultyMap.get(p.difficulty);
      if (diffStats) {
        diffStats.correct += p.correctAttempts;
        diffStats.wrong += p.wrongAttempts;
      }
    }

    // Last study date
    if (p.lastAttemptDate && (!stats.recentActivity.lastStudyDate || p.lastAttemptDate > stats.recentActivity.lastStudyDate)) {
      stats.recentActivity.lastStudyDate = p.lastAttemptDate;
    }
  }

  // Calculate overall accuracy
  const totalAttempts = totalCorrect + totalWrong;
  stats.overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) / 100 : 0;

  // Calculate recent accuracy from attempts
  const last7DaysAttempts = recentAttempts.filter(a => new Date(a.attemptedAt) >= sevenDaysAgo);
  const last30DaysAttempts = recentAttempts.filter(a => new Date(a.attemptedAt) >= thirtyDaysAgo);

  if (last7DaysAttempts.length > 0) {
    const correct7 = last7DaysAttempts.filter(a => a.isCorrect).length;
    stats.last7DaysAccuracy = Math.round((correct7 / last7DaysAttempts.length) * 100) / 100;
  }

  if (last30DaysAttempts.length > 0) {
    const correct30 = last30DaysAttempts.filter(a => a.isCorrect).length;
    stats.last30DaysAccuracy = Math.round((correct30 / last30DaysAttempts.length) * 100) / 100;
  }

  // Recent activity
  stats.recentActivity.questionsLast7Days = last7DaysAttempts.length;
  stats.recentActivity.questionsLast30Days = last30DaysAttempts.length;

  // Count unique study days in last 30
  const studyDays = new Set(
    last30DaysAttempts.map(a => new Date(a.attemptedAt).toDateString())
  );
  stats.recentActivity.studyDaysLast30 = studyDays.size;

  // Difficulty stats
  for (const [diff, data] of difficultyMap) {
    const total = data.correct + data.wrong;
    (stats.difficultyStats as any)[diff] = {
      attempted: total,
      accuracy: total > 0 ? Math.round((data.correct / total) * 100) / 100 : 0,
    };
  }

  // Topic performance
  stats.topicPerformance = Array.from(topicMap.entries())
    .map(([topic, data]) => ({
      topic,
      attempted: data.attempted,
      accuracy: (data.correct + data.wrong) > 0 
        ? Math.round((data.correct / (data.correct + data.wrong)) * 100) / 100 
        : 0,
      mastered: data.mastered,
      struggling: data.struggling,
      overdue: data.overdue,
    }))
    .sort((a, b) => b.attempted - a.attempted);

  // Streaks
  stats.streaks.longestQuestion = maxStreak;
  stats.streaks.currentQuestion = currentMaxStreak;

  // Confidence calibration
  if (confidenceCount > 0) {
    stats.confidenceCalibration.averageConfidence = Math.round((totalConfidence / confidenceCount) * 100) / 100;
    stats.confidenceCalibration.actualAccuracy = stats.overallAccuracy;
    
    // Normalize confidence to 0-1 scale (from 0-5)
    const normalizedConfidence = stats.confidenceCalibration.averageConfidence / 5;
    const calibrationDiff = Math.abs(normalizedConfidence - stats.overallAccuracy);
    stats.confidenceCalibration.calibrationScore = Math.round((1 - calibrationDiff) * 100) / 100;
    stats.confidenceCalibration.isOverconfident = normalizedConfidence > stats.overallAccuracy + 0.1;
    stats.confidenceCalibration.isUnderconfident = normalizedConfidence < stats.overallAccuracy - 0.1;
  }

  // Time stats
  if (responseTimeCount > 0) {
    stats.timeStats.averageResponseTimeMs = Math.round(totalResponseTime / responseTimeCount);
  }
  if (stats.timeStats.fastestResponseTimeMs === Infinity) {
    stats.timeStats.fastestResponseTimeMs = 0;
  }

  return stats;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    
    // Get total questions count from questions data
    const questions = require('./questions-data.json');
    const totalQuestions = questions.length;

    // Fetch data
    const [progress, recentAttempts] = await Promise.all([
      fetchProgress(userId),
      fetchRecentAttempts(userId, 30),
    ]);

    const stats = calculateStats(progress, recentAttempts, totalQuestions);

    return successResponse({ stats });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to get stats');
  }
};
