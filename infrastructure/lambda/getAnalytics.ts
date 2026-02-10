// Get Analytics Lambda - Comprehensive user analytics
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';

interface TopicAnalytics {
  topic: string;
  totalQuestions: number;
  attempted: number;
  mastered: number;
  struggling: number;
  accuracy: number;
  avgConfidence: number;
  lastStudied: string | null;
}

interface DailyActivity {
  date: string;
  attempts: number;
  correct: number;
  timeSpentMs: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const docClient = getDocClient();

    const progressTable = process.env.PROGRESS_TABLE;
    const attemptsTable = process.env.ATTEMPTS_TABLE;
    const sessionsTable = process.env.SESSIONS_TABLE;

    // Fetch all progress records
    const progressResult = await docClient.send(new QueryCommand({
      TableName: progressTable,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));
    const progressItems = progressResult.Items || [];

    // Fetch recent attempts (last 30 days worth)
    const attemptsResult = await docClient.send(new QueryCommand({
      TableName: attemptsTable,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Limit: 500,
      ScanIndexForward: false,
    }));
    const attemptItems = attemptsResult.Items || [];

    // Fetch recent sessions
    const sessionsResult = await docClient.send(new QueryCommand({
      TableName: sessionsTable,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Limit: 50,
      ScanIndexForward: false,
    }));
    const sessionItems = sessionsResult.Items || [];

    // Calculate topic analytics
    const topicMap = new Map<string, TopicAnalytics>();
    for (const item of progressItems as any[]) {
      const topic = item.topic || 'Unknown';
      const existing = topicMap.get(topic) || {
        topic,
        totalQuestions: 0,
        attempted: 0,
        mastered: 0,
        struggling: 0,
        accuracy: 0,
        avgConfidence: 0,
        lastStudied: null,
      };

      existing.totalQuestions++;
      if (item.totalAttempts > 0) {
        existing.attempted++;
        existing.accuracy += item.correctAttempts / item.totalAttempts;
        existing.avgConfidence += item.averageConfidenceRating || 0;
      }
      if (item.userStatus === 'mastered') existing.mastered++;
      if (item.userStatus === 'struggling') existing.struggling++;
      if (item.lastAttemptDate && (!existing.lastStudied || item.lastAttemptDate > existing.lastStudied)) {
        existing.lastStudied = item.lastAttemptDate;
      }

      topicMap.set(topic, existing);
    }

    // Finalize topic averages
    const topicAnalytics: TopicAnalytics[] = [];
    for (const [, data] of topicMap) {
      if (data.attempted > 0) {
        data.accuracy = Math.round((data.accuracy / data.attempted) * 100);
        data.avgConfidence = Math.round((data.avgConfidence / data.attempted) * 10) / 10;
      }
      topicAnalytics.push(data);
    }
    topicAnalytics.sort((a, b) => b.attempted - a.attempted);

    // Calculate daily activity (last 14 days)
    const dailyMap = new Map<string, DailyActivity>();
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, attempts: 0, correct: 0, timeSpentMs: 0 });
    }

    for (const item of attemptItems as any[]) {
      if (!item.attemptedAt) continue;
      const dateStr = item.attemptedAt.split('T')[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.attempts++;
        if (item.isCorrect) existing.correct++;
        existing.timeSpentMs += item.responseTimeMs || 0;
      }
    }

    const dailyActivity = Array.from(dailyMap.values()).reverse();

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const sortedDays = [...dailyActivity].reverse();
    
    for (const day of sortedDays) {
      if (day.attempts > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    
    // Current streak (from today backwards)
    for (const day of sortedDays) {
      if (day.attempts > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Overall stats
    const totalAttempts = progressItems.reduce((sum: number, p: any) => sum + (p.totalAttempts || 0), 0);
    const totalCorrect = progressItems.reduce((sum: number, p: any) => sum + (p.correctAttempts || 0), 0);
    const totalTimeMs = attemptItems.reduce((sum: number, a: any) => sum + (a.responseTimeMs || 0), 0);

    // SM-2 status counts
    const statusCounts = {
      learning: 0,
      reviewing: 0,
      mastered: 0,
      struggling: 0,
      new: 0,
    };
    for (const item of progressItems as any[]) {
      if (!item.totalAttempts) statusCounts.new++;
      else if (item.userStatus) statusCounts[item.userStatus as keyof typeof statusCounts]++;
    }

    // Due for review
    const nowIso = now.toISOString();
    let overdueCount = 0;
    let dueTodayCount = 0;
    let dueThisWeekCount = 0;
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    for (const item of progressItems as any[]) {
      const nextReview = item.sm2?.nextReviewDate || item.nextReviewDate;
      if (!nextReview) continue;
      
      if (nextReview < nowIso) overdueCount++;
      else if (nextReview.split('T')[0] === nowIso.split('T')[0]) dueTodayCount++;
      else if (nextReview < weekFromNow.toISOString()) dueThisWeekCount++;
    }

    // Confidence calibration
    let confidenceSum = 0;
    let confidenceCount = 0;
    for (const item of progressItems as any[]) {
      if (item.confidenceRatingsCount > 0) {
        confidenceSum += item.averageConfidenceRating;
        confidenceCount++;
      }
    }
    const avgConfidence = confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 10) / 10 : 0;

    return successResponse({
      overview: {
        totalQuestions: progressItems.length,
        totalAttempts,
        totalCorrect,
        overallAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
        totalStudyTimeMs: totalTimeMs,
        avgConfidence,
        currentStreak,
        longestStreak,
      },
      statusCounts,
      dueForReview: {
        overdue: overdueCount,
        dueToday: dueTodayCount,
        dueThisWeek: dueThisWeekCount,
      },
      topicAnalytics,
      dailyActivity,
      recentSessions: sessionItems.slice(0, 10).map((s: any) => ({
        sessionId: s.sessionId,
        quizType: s.quizType,
        topic: s.topic,
        questionsAnswered: s.questionsAnswered,
        correctAnswers: s.correctAnswers,
        startedAt: s.startedAt,
      })),
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to fetch analytics');
  }
};
