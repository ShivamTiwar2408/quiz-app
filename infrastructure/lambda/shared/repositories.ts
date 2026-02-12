/**
 * Repository Pattern Implementation for DynamoDB
 * Abstracts data access logic from Lambda handlers
 */

import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient, getProgressTable, getAttemptsTable, getSessionsTable, getNotesTable } from './db';
import { UserQuestionProgress, Note } from './types';

// ============================================
// INTERFACES
// ============================================

export interface IProgressRepository {
  getByUserId(userId: string): Promise<UserQuestionProgress[]>;
  getByUserAndQuestion(userId: string, questionId: string): Promise<UserQuestionProgress | null>;
  save(progress: UserQuestionProgress): Promise<void>;
  delete(userId: string, questionId: string): Promise<void>;
}

export interface INotesRepository {
  getByUserId(userId: string): Promise<Note[]>;
  getById(userId: string, noteId: string): Promise<Note | null>;
  save(note: Note): Promise<void>;
  delete(userId: string, noteId: string): Promise<void>;
}

export interface ISessionRepository {
  getById(sessionId: string): Promise<SessionRecord | null>;
  save(session: SessionRecord): Promise<void>;
  getByUserId(userId: string, limit?: number): Promise<SessionRecord[]>;
}

export interface IAttemptRepository {
  save(attempt: AttemptRecord): Promise<void>;
  getByUserId(userId: string, limit?: number): Promise<AttemptRecord[]>;
  getByQuestion(userId: string, questionId: string): Promise<AttemptRecord[]>;
}

export interface SessionRecord {
  sessionId: string;
  oderId: string;
  quizType: string;
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  startedAt: string;
  completedAt?: string;
}

export interface AttemptRecord {
  oderId: string;
  attemptId: string;
  sessionId: string;
  questionId: string;
  selectedAnswers: string[];
  isCorrect: boolean;
  confidenceRating: number;
  responseTimeMs: number;
  timestamp: string;
}

// ============================================
// IMPLEMENTATIONS
// ============================================

export class DynamoProgressRepository implements IProgressRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(docClient?: DynamoDBDocumentClient, tableName?: string) {
    this.docClient = docClient || getDocClient();
    this.tableName = tableName || getProgressTable();
  }

  async getByUserId(userId: string): Promise<UserQuestionProgress[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));
    return (result.Items || []) as UserQuestionProgress[];
  }

  async getByUserAndQuestion(userId: string, questionId: string): Promise<UserQuestionProgress | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { oderId: userId, questionId },
    }));
    return (result.Item as UserQuestionProgress) || null;
  }

  async save(progress: UserQuestionProgress): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: progress,
    }));
  }

  async delete(userId: string, questionId: string): Promise<void> {
    await this.docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { oderId: userId, questionId },
    }));
  }
}

export class DynamoNotesRepository implements INotesRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(docClient?: DynamoDBDocumentClient, tableName?: string) {
    this.docClient = docClient || getDocClient();
    this.tableName = tableName || getNotesTable();
  }

  async getByUserId(userId: string): Promise<Note[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));
    return (result.Items || []) as Note[];
  }

  async getById(userId: string, noteId: string): Promise<Note | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { oderId: userId, noteId },
    }));
    return (result.Item as Note) || null;
  }

  async save(note: Note): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: note,
    }));
  }

  async delete(userId: string, noteId: string): Promise<void> {
    await this.docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { oderId: userId, noteId },
    }));
  }
}

export class DynamoSessionRepository implements ISessionRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(docClient?: DynamoDBDocumentClient, tableName?: string) {
    this.docClient = docClient || getDocClient();
    this.tableName = tableName || getSessionsTable();
  }

  async getById(sessionId: string): Promise<SessionRecord | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { sessionId },
    }));
    return (result.Item as SessionRecord) || null;
  }

  async save(session: SessionRecord): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: session,
    }));
  }

  async getByUserId(userId: string, limit: number = 20): Promise<SessionRecord[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'userId-startedAt-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (result.Items || []) as SessionRecord[];
  }
}

export class DynamoAttemptRepository implements IAttemptRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(docClient?: DynamoDBDocumentClient, tableName?: string) {
    this.docClient = docClient || getDocClient();
    this.tableName = tableName || getAttemptsTable();
  }

  async save(attempt: AttemptRecord): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: attempt,
    }));
  }

  async getByUserId(userId: string, limit: number = 50): Promise<AttemptRecord[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (result.Items || []) as AttemptRecord[];
  }

  async getByQuestion(userId: string, questionId: string): Promise<AttemptRecord[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'userId-questionId-index',
      KeyConditionExpression: 'userId = :userId AND questionId = :questionId',
      ExpressionAttributeValues: { 
        ':userId': userId,
        ':questionId': questionId,
      },
    }));
    return (result.Items || []) as AttemptRecord[];
  }
}

// ============================================
// FACTORY
// ============================================

let progressRepo: IProgressRepository | null = null;
let notesRepo: INotesRepository | null = null;
let sessionRepo: ISessionRepository | null = null;
let attemptRepo: IAttemptRepository | null = null;

export function getProgressRepository(): IProgressRepository {
  if (!progressRepo) {
    progressRepo = new DynamoProgressRepository();
  }
  return progressRepo;
}

export function getNotesRepository(): INotesRepository {
  if (!notesRepo) {
    notesRepo = new DynamoNotesRepository();
  }
  return notesRepo;
}

export function getSessionRepository(): ISessionRepository {
  if (!sessionRepo) {
    sessionRepo = new DynamoSessionRepository();
  }
  return sessionRepo;
}

export function getAttemptRepository(): IAttemptRepository {
  if (!attemptRepo) {
    attemptRepo = new DynamoAttemptRepository();
  }
  return attemptRepo;
}

// For testing - allows injecting mock repositories
export function setProgressRepository(repo: IProgressRepository): void {
  progressRepo = repo;
}

export function setNotesRepository(repo: INotesRepository): void {
  notesRepo = repo;
}

export function setSessionRepository(repo: ISessionRepository): void {
  sessionRepo = repo;
}

export function setAttemptRepository(repo: IAttemptRepository): void {
  attemptRepo = repo;
}
