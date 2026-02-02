import { APIGatewayProxyHandler } from 'aws-lambda';
import { PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';
import { Note } from './shared/types';
import { randomUUID } from 'crypto';

const NOTES_TABLE = process.env.NOTES_TABLE_NAME || '';

const NOTE_COLORS = ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown'];

interface SaveNoteRequest {
  noteId?: string;
  title: string;
  content: string;
  color?: string;
  pinned?: boolean;
  quizMe?: boolean;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = getUserId(event);
    const docClient = getDocClient();
    
    if (!event.body) {
      return badRequestResponse('Request body is required');
    }
    
    const body: SaveNoteRequest = JSON.parse(event.body);
    
    // Allow empty title for quick notes
    const title = body.title?.trim() || '';
    const content = body.content?.trim() || '';
    
    if (!title && !content) {
      return badRequestResponse('Title or content is required');
    }
    
    const color = NOTE_COLORS.includes(body.color || '') ? body.color : 'default';
    const now = new Date().toISOString();
    
    if (body.noteId) {
      // Update existing note
      const existingNote = await docClient.send(new GetCommand({
        TableName: NOTES_TABLE,
        Key: { userId, noteId: body.noteId },
      }));
      
      if (!existingNote.Item) {
        return badRequestResponse('Note not found');
      }
      
      const updateCommand = new UpdateCommand({
        TableName: NOTES_TABLE,
        Key: { userId, noteId: body.noteId },
        UpdateExpression: 'SET title = :title, content = :content, color = :color, pinned = :pinned, quizMe = :quizMe, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':title': title,
          ':content': content,
          ':color': color,
          ':pinned': body.pinned ?? existingNote.Item.pinned ?? false,
          ':quizMe': body.quizMe ?? existingNote.Item.quizMe ?? false,
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      });
      
      const result = await docClient.send(updateCommand);
      return successResponse({ note: result.Attributes, updated: true });
    } else {
      // Create new note
      const note: Note = {
        noteId: randomUUID(),
        userId,
        title,
        content,
        color: color!,
        pinned: body.pinned ?? false,
        quizMe: body.quizMe ?? false,
        createdAt: now,
        updatedAt: now,
      };
      
      await docClient.send(new PutCommand({
        TableName: NOTES_TABLE,
        Item: note,
      }));
      
      return successResponse({ note, created: true });
    }
  } catch (error) {
    console.error('Error saving note:', error);
    return errorResponse('Failed to save note');
  }
};
