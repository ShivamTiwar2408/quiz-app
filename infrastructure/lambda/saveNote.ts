import { APIGatewayProxyHandler } from 'aws-lambda';
import { PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';
import { Note } from './shared/types';
import { randomUUID } from 'crypto';

const NOTES_TABLE = process.env.NOTES_TABLE || '';
const GENERATE_QUESTIONS_FUNCTION = process.env.GENERATE_QUESTIONS_FUNCTION || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const lambdaClient = new LambdaClient({ region: AWS_REGION });

const NOTE_COLORS = ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown'];

interface SaveNoteRequest {
  noteId?: string;
  title: string;
  content: string;
  color?: string;
  pinned?: boolean;
  quizMe?: boolean;
}

// Trigger instant question generation for a note
async function triggerQuestionGeneration(note: Note): Promise<void> {
  if (!GENERATE_QUESTIONS_FUNCTION) {
    console.log('GENERATE_QUESTIONS_FUNCTION not configured, skipping instant generation');
    return;
  }
  
  try {
    const command = new InvokeCommand({
      FunctionName: GENERATE_QUESTIONS_FUNCTION,
      InvocationType: 'Event', // Async invocation - don't wait for response
      Payload: JSON.stringify({
        mode: 'single',
        note,
      }),
    });
    
    await lambdaClient.send(command);
    console.log(`Triggered question generation for note: ${note.noteId}`);
  } catch (error) {
    // Log but don't fail the save operation
    console.error('Failed to trigger question generation:', error);
  }
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
      const updatedNote = result.Attributes as Note;
      
      // Trigger instant question generation if quizMe is enabled
      // Only trigger if quizMe was just enabled (wasn't true before)
      const wasQuizMeEnabled = existingNote.Item.quizMe;
      const isQuizMeEnabled = body.quizMe ?? existingNote.Item.quizMe ?? false;
      if (isQuizMeEnabled && !wasQuizMeEnabled) {
        await triggerQuestionGeneration(updatedNote);
      }
      
      return successResponse({ note: updatedNote, updated: true });
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
      
      // Trigger instant question generation if quizMe is enabled
      if (note.quizMe) {
        await triggerQuestionGeneration(note);
      }
      
      return successResponse({ note, created: true });
    }
  } catch (error) {
    console.error('Error saving note:', error);
    return errorResponse('Failed to save note');
  }
};
