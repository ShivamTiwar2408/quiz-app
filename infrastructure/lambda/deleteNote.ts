import { APIGatewayProxyHandler } from 'aws-lambda';
import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';

const NOTES_TABLE = process.env.NOTES_TABLE || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = getUserId(event);
    const docClient = getDocClient();
    
    const noteId = event.pathParameters?.noteId;
    
    if (!noteId) {
      return badRequestResponse('Note ID is required');
    }
    
    // Verify note exists and belongs to user
    const existingNote = await docClient.send(new GetCommand({
      TableName: NOTES_TABLE,
      Key: { userId, noteId },
    }));
    
    if (!existingNote.Item) {
      return badRequestResponse('Note not found');
    }
    
    await docClient.send(new DeleteCommand({
      TableName: NOTES_TABLE,
      Key: { userId, noteId },
    }));
    
    return successResponse({ deleted: true, noteId });
  } catch (error) {
    console.error('Error deleting note:', error);
    return errorResponse('Failed to delete note');
  }
};
