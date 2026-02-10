// Shared DynamoDB client
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let docClient: DynamoDBDocumentClient | null = null;

export function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({});
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

// Legacy support
export function getTableName(): string {
  const tableName = process.env.TABLE_NAME || process.env.PROGRESS_TABLE;
  if (!tableName) {
    throw new Error('TABLE_NAME or PROGRESS_TABLE environment variable is not set');
  }
  return tableName;
}

export function getProgressTable(): string {
  const tableName = process.env.PROGRESS_TABLE;
  if (!tableName) {
    throw new Error('PROGRESS_TABLE environment variable is not set');
  }
  return tableName;
}

export function getAttemptsTable(): string {
  const tableName = process.env.ATTEMPTS_TABLE;
  if (!tableName) {
    throw new Error('ATTEMPTS_TABLE environment variable is not set');
  }
  return tableName;
}

export function getSessionsTable(): string {
  const tableName = process.env.SESSIONS_TABLE;
  if (!tableName) {
    throw new Error('SESSIONS_TABLE environment variable is not set');
  }
  return tableName;
}

export function getNotesTable(): string {
  const tableName = process.env.NOTES_TABLE;
  if (!tableName) {
    throw new Error('NOTES_TABLE environment variable is not set');
  }
  return tableName;
}
