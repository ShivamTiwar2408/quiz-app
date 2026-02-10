// Get Attempts History Lambda - View past quiz attempts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const params = event.queryStringParameters || {};
    const limit = Math.min(parseInt(params.limit || '50', 10), 100);
    const questionId = params.questionId;

    const tableName = process.env.ATTEMPTS_TABLE;
    if (!tableName) {
      return errorResponse('Attempts table not configured');
    }

    const docClient = getDocClient();
    
    let result;
    if (questionId) {
      // Get attempts for specific question using GSI
      result = await docClient.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'QuestionIndex',
        KeyConditionExpression: 'questionId = :qid',
        FilterExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':qid': questionId,
          ':uid': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
      }));
    } else {
      // Get all attempts for user
      result = await docClient.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        Limit: limit,
        ScanIndexForward: false,
      }));
    }

    const attempts = (result.Items || []).map((item: any) => ({
      attemptId: item.attemptId,
      questionId: item.questionId,
      topic: item.topic,
      subtopic: item.subtopic,
      difficulty: item.difficulty,
      isCorrect: item.isCorrect,
      confidenceRating: item.confidenceRating,
      responseTimeMs: item.responseTimeMs,
      selectedAnswers: item.selectedAnswers,
      correctAnswers: item.correctAnswers,
      quizType: item.quizType,
      attemptedAt: item.attemptedAt,
    }));

    return successResponse({
      attempts,
      count: attempts.length,
      hasMore: result.LastEvaluatedKey !== undefined,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to fetch attempts');
  }
};
