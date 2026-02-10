// Generate Quiz Lambda - SM-2 Based Intelligent Quiz Generation
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';
import { Question, UserQuestionProgress, QuizType, GenerateQuizRequest } from './shared/types';
import { generateQuiz, convertLegacyMode } from './shared/quizGenerator';
import { v4 as uuidv4 } from 'uuid';
import questions from './questions-data.json';

const baseQuestions = questions as Question[];

async function fetchCustomQuestions(userId: string): Promise<Question[]> {
  const tableName = process.env.CUSTOM_QUESTIONS_TABLE;
  if (!tableName) return [];

  try {
    const docClient = getDocClient();
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));

    return (result.Items || []).map((item: any) => ({
      id: item.questionId,
      topic: item.topic,
      subtopic: item.subtopic,
      question: item.question,
      options: item.options,
      correct_answers: item.correct_answers,
      explanation: item.explanation,
      difficulty: item.difficulty,
      isCustom: true,
    })) as Question[];
  } catch (error) {
    console.error('Error fetching custom questions:', error);
    return [];
  }
}

interface ProgressWithHidden extends UserQuestionProgress {
  isHidden?: boolean;
}

async function fetchUserProgress(userId: string): Promise<{ progressMap: Map<string, UserQuestionProgress>; hiddenIds: Set<string> }> {
  const tableName = process.env.PROGRESS_TABLE;
  if (!tableName) return { progressMap: new Map(), hiddenIds: new Set() };

  try {
    const docClient = getDocClient();
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));

    const progressMap = new Map<string, UserQuestionProgress>();
    const hiddenIds = new Set<string>();
    
    for (const item of (result.Items || []) as ProgressWithHidden[]) {
      if (item.isHidden) {
        hiddenIds.add(item.questionId);
      } else {
        progressMap.set(item.questionId, item);
      }
    }
    return { progressMap, hiddenIds };
  } catch (error) {
    console.error('Error fetching progress:', error);
    return { progressMap: new Map(), hiddenIds: new Set() };
  }
}

async function saveSession(
  userId: string,
  sessionId: string,
  quizType: QuizType,
  questionIds: string[],
  topic?: string,
  subtopic?: string
): Promise<void> {
  const tableName = process.env.SESSIONS_TABLE;
  if (!tableName) return;

  try {
    const docClient = getDocClient();
    const now = new Date();
    const ttl = Math.floor(now.getTime() / 1000) + (7 * 24 * 60 * 60); // 7 days

    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        userId,
        sessionId,
        quizType,
        topic,
        subtopic,
        questionIds,
        totalQuestions: questionIds.length,
        questionsAnswered: 0,
        correctAnswers: 0,
        startedAt: now.toISOString(),
        ttl,
      },
    }));
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    
    // Support both POST body and GET query params (legacy)
    let request: GenerateQuizRequest;
    
    if (event.httpMethod === 'POST' && event.body) {
      const body = JSON.parse(event.body);
      request = {
        quizType: body.quizType || 'adaptive',
        count: body.count || 10,
        topic: body.topic,
        subtopic: body.subtopic,
        difficulty: body.difficulty,
        includeOverdue: body.includeOverdue ?? true,
      };
    } else {
      // Legacy GET support
      const params = event.queryStringParameters || {};
      const legacyMode = params.mode || 'smart';
      request = {
        quizType: convertLegacyMode(legacyMode),
        count: parseInt(params.count || '10', 10),
        topic: params.topic,
        subtopic: params.subtopic,
      };
    }

    // Fetch user progress
    const { progressMap, hiddenIds } = await fetchUserProgress(userId);

    // Fetch custom questions and merge with base questions
    const customQuestions = await fetchCustomQuestions(userId);
    const allQuestions = [...baseQuestions, ...customQuestions];
    
    // Filter out hidden questions
    const availableQuestions = allQuestions.filter(q => !hiddenIds.has(q.id));

    // Generate quiz using the intelligent algorithm
    const result = generateQuiz(availableQuestions, progressMap, request);

    if (result.questions.length === 0) {
      return successResponse({
        sessionId: null,
        questions: [],
        message: 'No questions available for the selected criteria',
      });
    }

    // Create session
    const sessionId = uuidv4();
    await saveSession(
      userId,
      sessionId,
      request.quizType,
      result.questions.map(q => q.id),
      request.topic,
      request.subtopic
    );

    // Shuffle options for each question
    const questionsWithShuffledOptions = result.questions.map(q => ({
      ...q,
      options: q.options, // Options are already keyed by letter, no need to shuffle
    }));

    return successResponse({
      sessionId,
      questions: questionsWithShuffledOptions,
      quizType: request.quizType,
      total: availableQuestions.length,
      hiddenCount: hiddenIds.size,
      returned: result.questions.length,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error');
  }
};
