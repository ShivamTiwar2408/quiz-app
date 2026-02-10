// Get Progress Lambda - Enhanced with SM-2 data
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';
import { UserQuestionProgress, UserStats, TopicStat, GetProgressResponse } from './shared/types';
import { isDueForReview, getDaysUntilReview } from './shared/sm2';

function createEmptyStats(userId: string): UserStats {
  return {
    userId,
    totalQuestionsAttempted: 0,
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    overallAccuracy: 0,
    learningCount: 0,
    reviewingCount: 0,
    masteredCount: 0,
    strugglingCount: 0,
    overdueCount: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueThisWeek: 0,
    currentDailyStreak: 0,
    longestDailyStreak: 0,
    lastStudyDate: '',
    topicStats: {},
    averageConfidence: 0,
    confidenceAccuracyCorrelation: 0,
    totalStudyTimeMs: 0,
    averageSessionTimeMs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function aggregateStats(
  userId: string,
  items: UserQuestionProgress[]
): {
  progress: Record<string, UserQuestionProgress>;
  stats: UserStats;
  dueForReview: { overdue: string[]; dueToday: string[]; dueTomorrow: string[] };
} {
  const progress: Record<string, UserQuestionProgress> = {};
  const stats = createEmptyStats(userId);
  const dueForReview = {
    overdue: [] as string[],
    dueToday: [] as string[],
    dueTomorrow: [] as string[],
  };

  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const item of items) {
    progress[item.questionId] = item;

    // Count by status
    if (item.userStatus === 'learning') stats.learningCount++;
    else if (item.userStatus === 'reviewing') stats.reviewingCount++;
    else if (item.userStatus === 'mastered') stats.masteredCount++;
    else if (item.userStatus === 'struggling') stats.strugglingCount++;

    // Aggregate totals
    stats.totalQuestionsAttempted++;
    stats.totalCorrectAnswers += item.correctAttempts;
    stats.totalWrongAnswers += item.wrongAttempts;

    // Confidence tracking
    if (item.confidenceRatingsCount > 0) {
      totalConfidence += item.averageConfidenceRating * item.confidenceRatingsCount;
      confidenceCount += item.confidenceRatingsCount;
    }

    // Due for review tracking
    if (item.sm2?.nextReviewDate) {
      const daysUntil = getDaysUntilReview(item.sm2.nextReviewDate);
      if (daysUntil < 0) {
        stats.overdueCount++;
        dueForReview.overdue.push(item.questionId);
      } else if (daysUntil === 0) {
        stats.dueToday++;
        dueForReview.dueToday.push(item.questionId);
      } else if (daysUntil === 1) {
        stats.dueTomorrow++;
        dueForReview.dueTomorrow.push(item.questionId);
      } else if (daysUntil <= 7) {
        stats.dueThisWeek++;
      }
    }

    // Topic stats
    if (item.topic) {
      if (!stats.topicStats[item.topic]) {
        stats.topicStats[item.topic] = {
          topic: item.topic,
          totalQuestions: 0,
          attemptedQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          accuracy: 0,
          masteredCount: 0,
          strugglingCount: 0,
          averageConfidence: 0,
          lastStudiedAt: '',
        };
      }
      const topicStat = stats.topicStats[item.topic];
      topicStat.attemptedQuestions++;
      topicStat.correctAnswers += item.correctAttempts;
      topicStat.wrongAnswers += item.wrongAttempts;
      if (item.userStatus === 'mastered') topicStat.masteredCount++;
      if (item.userStatus === 'struggling') topicStat.strugglingCount++;
      if (item.lastAttemptDate && (!topicStat.lastStudiedAt || item.lastAttemptDate > topicStat.lastStudiedAt)) {
        topicStat.lastStudiedAt = item.lastAttemptDate;
      }
    }

    // Track last study date
    if (item.lastAttemptDate && (!stats.lastStudyDate || item.lastAttemptDate > stats.lastStudyDate)) {
      stats.lastStudyDate = item.lastAttemptDate;
    }
  }

  // Calculate overall accuracy
  const totalAttempts = stats.totalCorrectAnswers + stats.totalWrongAnswers;
  stats.overallAccuracy = totalAttempts > 0 
    ? Math.round((stats.totalCorrectAnswers / totalAttempts) * 100) / 100 
    : 0;

  // Calculate average confidence
  stats.averageConfidence = confidenceCount > 0 
    ? Math.round((totalConfidence / confidenceCount) * 100) / 100 
    : 0;

  // Calculate topic accuracies
  for (const topicStat of Object.values(stats.topicStats)) {
    const topicTotal = topicStat.correctAnswers + topicStat.wrongAnswers;
    topicStat.accuracy = topicTotal > 0 
      ? Math.round((topicStat.correctAnswers / topicTotal) * 100) / 100 
      : 0;
  }

  stats.updatedAt = new Date().toISOString();

  return { progress, stats, dueForReview };
}

// Convert to legacy format for backward compatibility
function toLegacyProgress(progress: Record<string, UserQuestionProgress>): Record<string, any> {
  const legacy: Record<string, any> = {};
  
  for (const [id, p] of Object.entries(progress)) {
    // Determine legacy status
    let status: 'known' | 'remind' | 'wrong' | null = null;
    if (p.userStatus === 'mastered') status = 'known';
    else if (p.userStatus === 'struggling') status = 'wrong';
    else if (p.flaggedForReview) status = 'remind';
    else if (p.totalAttempts > 0) {
      const accuracy = p.correctAttempts / p.totalAttempts;
      if (accuracy >= 0.9) status = 'known';
      else if (accuracy < 0.6) status = 'wrong';
      else status = 'remind';
    }

    legacy[id] = {
      questionId: p.questionId,
      topic: p.topic,
      subtopic: p.subtopic,
      status,
      answeredCorrectly: p.correctAttempts > p.wrongAttempts,
      wrongCount: p.wrongAttempts,
      correctCount: p.correctAttempts,
      remindCount: p.flaggedForReview ? 1 : 0,
      knownCount: p.userStatus === 'mastered' ? 1 : 0,
      lastAnswered: p.lastAttemptDate,
      // New SM-2 fields
      sm2: p.sm2,
      userStatus: p.userStatus,
      currentStreak: p.currentStreak,
      averageConfidence: p.averageConfidenceRating,
    };
  }
  
  return legacy;
}

// Convert stats to legacy format
function toLegacyStats(stats: UserStats): any {
  return {
    totalAnswered: stats.totalQuestionsAttempted,
    totalCorrect: stats.totalCorrectAnswers,
    totalWrong: stats.totalWrongAnswers,
    totalKnown: stats.masteredCount,
    totalRemind: stats.reviewingCount + stats.learningCount,
    topicStats: Object.fromEntries(
      Object.entries(stats.topicStats).map(([topic, stat]) => [
        topic,
        {
          answered: stat.attemptedQuestions,
          correct: stat.correctAnswers,
          wrong: stat.wrongAnswers,
        },
      ])
    ),
    // New fields
    overallAccuracy: stats.overallAccuracy,
    overdueCount: stats.overdueCount,
    dueToday: stats.dueToday,
    learningCount: stats.learningCount,
    reviewingCount: stats.reviewingCount,
    masteredCount: stats.masteredCount,
    strugglingCount: stats.strugglingCount,
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const tableName = process.env.PROGRESS_TABLE;

    if (!tableName) {
      return successResponse({
        progress: {},
        stats: toLegacyStats(createEmptyStats(userId)),
      });
    }

    const docClient = getDocClient();
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));

    const { progress, stats, dueForReview } = aggregateStats(
      userId,
      (result.Items || []) as UserQuestionProgress[]
    );

    // Return both legacy and new format
    return successResponse({
      progress: toLegacyProgress(progress),
      stats: toLegacyStats(stats),
      // New fields
      dueForReview,
      fullStats: stats,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to get progress');
  }
};
