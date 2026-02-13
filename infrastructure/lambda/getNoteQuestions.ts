import { APIGatewayProxyHandler } from 'aws-lambda';
import { QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';

const NOTE_QUESTIONS_TABLE = process.env.NOTE_QUESTIONS_TABLE_NAME || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = getUserId(event);
    const docClient = getDocClient();
    const method = event.httpMethod;
    const questionId = event.pathParameters?.questionId;

    // GET /note-questions - List all note questions for user
    if (method === 'GET' && !questionId) {
      const count = parseInt(event.queryStringParameters?.count || '100', 10);
      const forQuiz = event.queryStringParameters?.forQuiz === 'true';
      
      const command = new QueryCommand({
        TableName: NOTE_QUESTIONS_TABLE,
        IndexName: 'OwnerIndex',
        KeyConditionExpression: 'ownerId = :ownerId',
        ExpressionAttributeValues: {
          ':ownerId': userId,
        },
        ScanIndexForward: false, // Most recent first
      });
      
      const result = await docClient.send(command);
      let questions = result.Items || [];
      
      // For quiz mode, shuffle and limit
      if (forQuiz) {
        questions = questions
          .sort(() => Math.random() - 0.5)
          .slice(0, count);
      }
      
      // Transform to match Question interface expected by frontend
      const formattedQuestions = questions.map((q: any) => ({
        questionId: `${q.noteId}#${q.generatedAt}`,
        id: `note-${q.noteId}-${q.generatedAt}`,
        topic: 'My Notes',
        subtopic: q.noteTitle || 'Note',
        question: q.question,
        options: q.options,
        correct_answers: q.correct_answers,
        explanation: q.explanation,
        difficulty: q.difficulty || 'medium',
        category: 'notes',
        noteId: q.noteId,
        noteTitle: q.noteTitle,
        noteContent: q.noteContent,
        generatedAt: q.generatedAt,
        isNoteQuestion: true,
      }));
      
      return successResponse({
        questions: formattedQuestions,
        count: formattedQuestions.length,
        source: 'notes',
      });
    }

    // PUT /note-questions/{questionId} - Update a note question
    if (method === 'PUT' && questionId) {
      const body = JSON.parse(event.body || '{}');
      const [noteId, generatedAt] = questionId.split('#');
      
      if (!noteId || !generatedAt) {
        return errorResponse('Invalid question ID format', 400);
      }
      
      // Build update expression dynamically
      const updateFields: string[] = [];
      const expressionValues: Record<string, any> = {};
      const expressionNames: Record<string, string> = {};
      
      if (body.question !== undefined) {
        updateFields.push('#question = :question');
        expressionNames['#question'] = 'question';
        expressionValues[':question'] = body.question;
      }
      if (body.options !== undefined) {
        updateFields.push('#options = :options');
        expressionNames['#options'] = 'options';
        expressionValues[':options'] = body.options;
      }
      if (body.correct_answers !== undefined) {
        updateFields.push('correct_answers = :correct_answers');
        expressionValues[':correct_answers'] = body.correct_answers;
      }
      if (body.explanation !== undefined) {
        updateFields.push('explanation = :explanation');
        expressionValues[':explanation'] = body.explanation;
      }
      if (body.difficulty !== undefined) {
        updateFields.push('difficulty = :difficulty');
        expressionValues[':difficulty'] = body.difficulty;
      }
      
      if (updateFields.length === 0) {
        return errorResponse('No fields to update', 400);
      }
      
      updateFields.push('updatedAt = :updatedAt');
      expressionValues[':updatedAt'] = new Date().toISOString();
      expressionValues[':ownerId'] = userId;
      
      const command = new UpdateCommand({
        TableName: NOTE_QUESTIONS_TABLE,
        Key: { noteId, generatedAt },
        UpdateExpression: `SET ${updateFields.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
        ConditionExpression: 'ownerId = :ownerId',
        ReturnValues: 'ALL_NEW',
      });
      
      const result = await docClient.send(command);
      const q = result.Attributes;
      
      return successResponse({
        question: {
          questionId: `${q?.noteId}#${q?.generatedAt}`,
          id: `note-${q?.noteId}-${q?.generatedAt}`,
          topic: 'My Notes',
          subtopic: q?.noteTitle || 'Note',
          question: q?.question,
          options: q?.options,
          correct_answers: q?.correct_answers,
          explanation: q?.explanation,
          difficulty: q?.difficulty || 'medium',
          noteId: q?.noteId,
          noteTitle: q?.noteTitle,
          generatedAt: q?.generatedAt,
          isNoteQuestion: true,
        },
      });
    }

    // DELETE /note-questions/{questionId} - Delete a note question
    if (method === 'DELETE' && questionId) {
      const [noteId, generatedAt] = questionId.split('#');
      
      if (!noteId || !generatedAt) {
        return errorResponse('Invalid question ID format', 400);
      }
      
      const command = new DeleteCommand({
        TableName: NOTE_QUESTIONS_TABLE,
        Key: { noteId, generatedAt },
        ConditionExpression: 'ownerId = :ownerId',
        ExpressionAttributeValues: {
          ':ownerId': userId,
        },
      });
      
      await docClient.send(command);
      
      return successResponse({ deleted: true, questionId });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('Error in note questions handler:', error);
    if (error.name === 'ConditionalCheckFailedException') {
      return errorResponse('Question not found or access denied', 404);
    }
    return errorResponse('Failed to process note questions request');
  }
};
