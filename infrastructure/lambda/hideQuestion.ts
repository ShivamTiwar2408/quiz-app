// Hide/Unhide Questions Lambda - Allow users to exclude questions from quizzes
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';

const HIDDEN_MARKER = '__HIDDEN__';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const method = event.httpMethod;
    const tableName = process.env.PROGRESS_TABLE;

    if (!tableName) {
      return errorResponse('Progress table not configured');
    }

    const docClient = getDocClient();

    // GET - List hidden questions
    if (method === 'GET') {
      const result = await docClient.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'isHidden = :hidden',
        ExpressionAttributeValues: { 
          ':userId': userId,
          ':hidden': true,
        },
      }));

      const hiddenIds = (result.Items || []).map((item: any) => ({
        questionId: item.questionId,
        topic: item.topic,
        subtopic: item.subtopic,
        hiddenAt: item.hiddenAt,
        hideReason: item.hideReason,
      }));

      return successResponse({
        hiddenQuestions: hiddenIds,
        count: hiddenIds.length,
      });
    }

    // POST - Hide a question
    if (method === 'POST') {
      if (!event.body) {
        return badRequestResponse('Request body required');
      }

      const body = JSON.parse(event.body);
      const { questionId, topic, subtopic, reason } = body;

      if (!questionId) {
        return badRequestResponse('questionId is required');
      }

      // Check if progress record exists
      const existing = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId, questionId },
      }));

      const now = new Date().toISOString();

      if (existing.Item) {
        // Update existing progress record to mark as hidden
        await docClient.send(new PutCommand({
          TableName: tableName,
          Item: {
            ...existing.Item,
            isHidden: true,
            hiddenAt: now,
            hideReason: reason || 'User marked as not useful',
            updatedAt: now,
          },
        }));
      } else {
        // Create a minimal progress record just to track hidden status
        await docClient.send(new PutCommand({
          TableName: tableName,
          Item: {
            userId,
            questionId,
            topic: topic || 'Unknown',
            subtopic: subtopic || 'Unknown',
            difficulty: 'medium',
            isHidden: true,
            hiddenAt: now,
            hideReason: reason || 'User marked as not useful',
            // Minimal SM2 data
            sm2: {
              easeFactor: 2.5,
              interval: 0,
              repetitions: 0,
              nextReviewDate: now,
              lastReviewDate: now,
            },
            totalAttempts: 0,
            correctAttempts: 0,
            wrongAttempts: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastConfidenceRating: 0,
            averageConfidenceRating: 0,
            confidenceRatingsCount: 0,
            averageResponseTimeMs: 0,
            lastResponseTimeMs: 0,
            userStatus: null,
            flaggedForReview: false,
            firstAttemptDate: now,
            lastAttemptDate: now,
            createdAt: now,
            updatedAt: now,
          },
        }));
      }

      return successResponse({ 
        message: 'Question hidden successfully',
        questionId,
      });
    }

    // DELETE - Unhide a question
    if (method === 'DELETE') {
      const questionId = event.pathParameters?.questionId;
      if (!questionId) {
        return badRequestResponse('Question ID required');
      }

      const existing = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId, questionId },
      }));

      if (!existing.Item) {
        return errorResponse('Question not found', 404);
      }

      // Remove hidden flag
      const { isHidden, hiddenAt, hideReason, ...rest } = existing.Item as any;
      
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          ...rest,
          isHidden: false,
          updatedAt: new Date().toISOString(),
        },
      }));

      return successResponse({ 
        message: 'Question unhidden successfully',
        questionId,
      });
    }

    return badRequestResponse('Method not allowed');
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to manage hidden question');
  }
};
