// Get Sessions History Lambda - View past quiz sessions
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const params = event.queryStringParameters || {};
    const limit = Math.min(parseInt(params.limit || '20', 10), 50);

    const tableName = process.env.SESSIONS_TABLE;
    if (!tableName) {
      return errorResponse('Sessions table not configured');
    }

    const docClient = getDocClient();
    
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    }));

    const sessions = (result.Items || []).map((item: any) => ({
      sessionId: item.sessionId,
      quizType: item.quizType,
      topic: item.topic,
      subtopic: item.subtopic,
      totalQuestions: item.totalQuestions,
      questionsAnswered: item.questionsAnswered,
      correctAnswers: item.correctAnswers,
      accuracy: item.questionsAnswered > 0 
        ? Math.round((item.correctAnswers / item.questionsAnswered) * 100) 
        : 0,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      totalTimeMs: item.totalTimeMs,
    }));

    return successResponse({
      sessions,
      count: sessions.length,
      hasMore: result.LastEvaluatedKey !== undefined,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to fetch sessions');
  }
};
