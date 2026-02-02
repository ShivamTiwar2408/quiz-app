import { APIGatewayProxyHandler } from 'aws-lambda';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';

const NOTE_QUESTIONS_TABLE = process.env.NOTE_QUESTIONS_TABLE_NAME || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = getUserId(event);
    const docClient = getDocClient();
    
    const count = parseInt(event.queryStringParameters?.count || '10', 10);
    
    // Query questions for this user's notes using GSI
    const command = new QueryCommand({
      TableName: NOTE_QUESTIONS_TABLE,
      IndexName: 'OwnerIndex',
      KeyConditionExpression: 'ownerId = :ownerId',
      ExpressionAttributeValues: {
        ':ownerId': userId,
      },
    });
    
    const result = await docClient.send(command);
    let questions = result.Items || [];
    
    // Shuffle and limit
    questions = questions
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
    
    // Transform to match Question interface expected by frontend
    const formattedQuestions = questions.map((q: any) => ({
      id: `note-${q.noteId}`,
      topic: 'My Notes',
      subtopic: q.noteTitle || 'Note',
      question: q.question,
      options: q.options,
      correct_answers: q.correct_answers,
      explanation: `${q.explanation}\n\n---\n📝 **From your note:**\n${q.noteContent}`,
      difficulty: q.difficulty,
      category: 'notes',
      noteId: q.noteId,
    }));
    
    return successResponse({
      questions: formattedQuestions,
      count: formattedQuestions.length,
      source: 'notes',
    });
  } catch (error) {
    console.error('Error fetching note questions:', error);
    return errorResponse('Failed to fetch note questions');
  }
};
