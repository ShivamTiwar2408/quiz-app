import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient, getTableName } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';
import { UserProgress, UserStats } from './shared/types';

function createEmptyStats(): UserStats {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    totalWrong: 0,
    totalKnown: 0,
    totalRemind: 0,
    topicStats: {},
  };
}

function aggregateStats(items: UserProgress[]): { progress: Record<string, Partial<UserProgress>>; stats: UserStats } {
  const progress: Record<string, Partial<UserProgress>> = {};
  const stats = createEmptyStats();

  for (const item of items) {
    progress[item.questionId] = {
      questionId: item.questionId,
      topic: item.topic,
      subtopic: item.subtopic,
      status: item.status,
      answeredCorrectly: item.answeredCorrectly,
      wrongCount: item.wrongCount || 0,
      correctCount: item.correctCount || 0,
      remindCount: item.remindCount || 0,
      knownCount: item.knownCount || 0,
      lastAnswered: item.lastAnswered,
    };

    stats.totalAnswered++;
    stats.totalCorrect += item.correctCount || 0;
    stats.totalWrong += item.wrongCount || 0;

    if (item.status === 'known') stats.totalKnown++;
    if (item.status === 'remind') stats.totalRemind++;

    if (item.topic) {
      if (!stats.topicStats[item.topic]) {
        stats.topicStats[item.topic] = { answered: 0, correct: 0, wrong: 0 };
      }
      stats.topicStats[item.topic].answered++;
      stats.topicStats[item.topic].correct += item.correctCount || 0;
      stats.topicStats[item.topic].wrong += item.wrongCount || 0;
    }
  }

  return { progress, stats };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const docClient = getDocClient();
    const tableName = getTableName();

    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));

    const { progress, stats } = aggregateStats((result.Items || []) as UserProgress[]);

    return successResponse({ progress, stats });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to get progress');
  }
};
