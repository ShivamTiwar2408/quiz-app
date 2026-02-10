import { APIGatewayProxyHandler } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';

const NOTES_TABLE = process.env.NOTES_TABLE || process.env.NOTES_TABLE_NAME || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = getUserId(event);
    const docClient = getDocClient();
    
    // Get all notes for user, sorted by updatedAt desc
    const command = new QueryCommand({
      TableName: NOTES_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
    });
    
    const result = await docClient.send(command);
    const notes = result.Items || [];
    
    // Sort: pinned first, then by updatedAt
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    
    return successResponse({
      notes,
      count: notes.length,
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return errorResponse('Failed to fetch notes');
  }
};
