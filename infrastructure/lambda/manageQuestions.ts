// Manage Custom Questions Lambda - CRUD for user-created questions
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';
import { v4 as uuidv4 } from 'uuid';

interface CustomQuestion {
  questionId: string;
  userId: string;
  topic: string;
  subtopic: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isCustom: true;
  createdAt: string;
  updatedAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const method = event.httpMethod;
    const tableName = process.env.CUSTOM_QUESTIONS_TABLE;

    if (!tableName) {
      return errorResponse('Custom questions table not configured');
    }

    const docClient = getDocClient();

    // GET - List custom questions
    if (method === 'GET') {
      const params = event.queryStringParameters || {};
      const topic = params.topic;

      let result;
      if (topic) {
        result = await docClient.send(new QueryCommand({
          TableName: tableName,
          IndexName: 'TopicIndex',
          KeyConditionExpression: 'userId = :userId AND topic = :topic',
          ExpressionAttributeValues: { ':userId': userId, ':topic': topic },
        }));
      } else {
        result = await docClient.send(new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
        }));
      }

      return successResponse({
        questions: result.Items || [],
        count: (result.Items || []).length,
      });
    }

    // POST - Create new question
    if (method === 'POST') {
      if (!event.body) {
        return badRequestResponse('Request body required');
      }

      const body = JSON.parse(event.body);
      const { topic, subtopic, question, options, correct_answers, explanation, difficulty } = body;

      // Validation
      if (!topic || !subtopic || !question || !options || !correct_answers || !explanation) {
        return badRequestResponse('Missing required fields: topic, subtopic, question, options, correct_answers, explanation');
      }

      if (!Array.isArray(correct_answers) || correct_answers.length === 0) {
        return badRequestResponse('correct_answers must be a non-empty array');
      }

      if (typeof options !== 'object' || Object.keys(options).length < 2) {
        return badRequestResponse('options must have at least 2 choices');
      }

      // Validate correct answers exist in options
      for (const answer of correct_answers) {
        if (!options[answer]) {
          return badRequestResponse(`correct_answer "${answer}" not found in options`);
        }
      }

      const now = new Date().toISOString();
      const questionId = `custom_${userId.substring(0, 8)}_${uuidv4().substring(0, 8)}`;

      const newQuestion: CustomQuestion = {
        questionId,
        userId,
        topic,
        subtopic,
        question,
        options,
        correct_answers,
        explanation,
        difficulty: difficulty || 'medium',
        isCustom: true,
        createdAt: now,
        updatedAt: now,
      };

      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: newQuestion,
      }));

      return successResponse({ question: newQuestion, message: 'Question created successfully' });
    }

    // PUT - Update question
    if (method === 'PUT') {
      const questionId = event.pathParameters?.questionId;
      if (!questionId) {
        return badRequestResponse('Question ID required');
      }

      if (!event.body) {
        return badRequestResponse('Request body required');
      }

      // Verify ownership
      const existing = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId, questionId },
      }));

      if (!existing.Item) {
        return errorResponse('Question not found or access denied', 404);
      }

      const body = JSON.parse(event.body);
      const updates = {
        ...existing.Item,
        ...body,
        userId, // Prevent userId change
        questionId, // Prevent questionId change
        isCustom: true,
        updatedAt: new Date().toISOString(),
      };

      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: updates,
      }));

      return successResponse({ question: updates, message: 'Question updated successfully' });
    }

    // DELETE - Remove question
    if (method === 'DELETE') {
      const questionId = event.pathParameters?.questionId;
      if (!questionId) {
        return badRequestResponse('Question ID required');
      }

      // Verify ownership before delete
      const existing = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId, questionId },
      }));

      if (!existing.Item) {
        return errorResponse('Question not found or access denied', 404);
      }

      await docClient.send(new DeleteCommand({
        TableName: tableName,
        Key: { userId, questionId },
      }));

      return successResponse({ message: 'Question deleted successfully' });
    }

    return badRequestResponse('Method not allowed');
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to manage question');
  }
};
