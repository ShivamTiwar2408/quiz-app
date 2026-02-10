// Submit Answer Lambda - SM-2 Based Progress Update
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';
import { UserQuestionProgress, QuizAttempt, SubmitAnswerRequest } from './shared/types';
import { 
  calculateSM2Update, 
  updateProgressAfterAttempt, 
  createInitialProgress,
  determineUserStatus 
} from './shared/sm2';
import { v4 as uuidv4 } from 'uuid';
import questions from './questions-data.json';

const questionsMap = new Map(questions.map((q: any) => [q.id, q]));

interface LegacyProgressInput {
  questionId: string;
  topic: string;
  subtopic: string;
  status: 'known' | 'remind' | 'wrong';
  answeredCorrectly: boolean;
}

async function getExistingProgress(
  userId: string,
  questionId: string
): Promise<UserQuestionProgress | null> {
  const tableName = process.env.PROGRESS_TABLE;
  if (!tableName) return null;

  try {
    const docClient = getDocClient();
    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { userId, questionId },
    }));
    return (result.Item as UserQuestionProgress) || null;
  } catch (error) {
    console.error('Error fetching progress:', error);
    return null;
  }
}

async function saveProgress(progress: UserQuestionProgress): Promise<void> {
  const tableName = process.env.PROGRESS_TABLE;
  if (!tableName) return;

  try {
    const docClient = getDocClient();
    
    // Flatten SM2 data for DynamoDB indexing
    const item = {
      ...progress,
      nextReviewDate: progress.sm2.nextReviewDate,
      easeFactor: progress.sm2.easeFactor,
      interval: progress.sm2.interval,
      repetitions: progress.sm2.repetitions,
    };

    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: item,
    }));
  } catch (error) {
    console.error('Error saving progress:', error);
    throw error;
  }
}

async function saveAttempt(attempt: QuizAttempt): Promise<void> {
  const tableName = process.env.ATTEMPTS_TABLE;
  if (!tableName) return;

  try {
    const docClient = getDocClient();
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days

    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: { ...attempt, ttl },
    }));
  } catch (error) {
    console.error('Error saving attempt:', error);
  }
}

async function updateSession(
  userId: string,
  sessionId: string,
  isCorrect: boolean
): Promise<void> {
  const tableName = process.env.SESSIONS_TABLE;
  if (!tableName || !sessionId) return;

  try {
    const docClient = getDocClient();
    await docClient.send(new UpdateCommand({
      TableName: tableName,
      Key: { userId, sessionId },
      UpdateExpression: 'SET questionsAnswered = questionsAnswered + :one, correctAnswers = correctAnswers + :correct',
      ExpressionAttributeValues: {
        ':one': 1,
        ':correct': isCorrect ? 1 : 0,
      },
    }));
  } catch (error) {
    console.error('Error updating session:', error);
  }
}

// Convert legacy confidence to 0-5 scale
function convertLegacyToConfidence(status: string, isCorrect: boolean): number {
  if (!isCorrect) {
    return status === 'wrong' ? 1 : 2;
  }
  if (status === 'known') return 5;
  if (status === 'remind') return 3;
  return 4;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');

    // Check if this is the new format or legacy format
    if (body.questionId && body.selectedAnswers !== undefined) {
      // New SM-2 format
      const {
        sessionId,
        questionId,
        selectedAnswers,
        confidenceRating = 4, // Default to "correct with hesitation"
        responseTimeMs = 0,
      } = body as SubmitAnswerRequest;

      // Get question data
      const question = questionsMap.get(questionId) as any;
      if (!question) {
        return badRequestResponse('Question not found');
      }

      // Check correctness
      const correctAnswers = question.correct_answers;
      const isCorrect = 
        correctAnswers.length === selectedAnswers.length &&
        correctAnswers.every((c: string) => selectedAnswers.includes(c));

      // Get existing progress or create new
      let progress = await getExistingProgress(userId, questionId);
      
      if (!progress) {
        progress = createInitialProgress(
          userId,
          questionId,
          question.topic,
          question.subtopic,
          question.difficulty
        );
      }

      // Update progress with SM-2 algorithm
      const updatedProgress = updateProgressAfterAttempt(
        progress,
        isCorrect,
        confidenceRating,
        responseTimeMs
      );

      // Save progress
      await saveProgress(updatedProgress);

      // Save attempt for analytics
      const attempt: QuizAttempt = {
        attemptId: uuidv4(),
        userId,
        questionId,
        selectedAnswers,
        correctAnswers,
        isCorrect,
        confidenceRating,
        responseTimeMs,
        quizType: 'adaptive', // Could be passed from session
        topic: question.topic,
        subtopic: question.subtopic,
        difficulty: question.difficulty,
        attemptedAt: new Date().toISOString(),
      };
      await saveAttempt(attempt);

      // Update session if provided
      if (sessionId) {
        await updateSession(userId, sessionId, isCorrect);
      }

      return successResponse({
        isCorrect,
        correctAnswers,
        explanation: question.explanation,
        nextReviewDate: updatedProgress.sm2.nextReviewDate,
        newInterval: updatedProgress.sm2.interval,
        newEaseFactor: updatedProgress.sm2.easeFactor,
        newStatus: updatedProgress.userStatus,
        streakUpdate: {
          currentStreak: updatedProgress.currentStreak,
          isNewRecord: updatedProgress.currentStreak === updatedProgress.longestStreak && updatedProgress.currentStreak > 1,
        },
        relatedConcepts: question.relatedConcepts || [],
      });
    }

    // Legacy format support
    if (body.progress && Array.isArray(body.progress)) {
      // Batch update (legacy)
      for (const item of body.progress as LegacyProgressInput[]) {
        const question = questionsMap.get(item.questionId) as any;
        if (!question) continue;

        let progress = await getExistingProgress(userId, item.questionId);
        if (!progress) {
          progress = createInitialProgress(
            userId,
            item.questionId,
            item.topic || question.topic,
            item.subtopic || question.subtopic,
            question.difficulty
          );
        }

        const confidence = convertLegacyToConfidence(item.status, item.answeredCorrectly);
        const updatedProgress = updateProgressAfterAttempt(
          progress,
          item.answeredCorrectly,
          confidence,
          0
        );

        await saveProgress(updatedProgress);
      }

      return successResponse({
        message: 'Progress saved',
        count: body.progress.length,
      });
    }

    // Single legacy update
    const { questionId, topic, subtopic, status, answeredCorrectly } = body as LegacyProgressInput;

    if (!questionId || !status || answeredCorrectly === undefined) {
      return badRequestResponse('Missing required fields');
    }

    const question = questionsMap.get(questionId) as any;
    if (!question) {
      return badRequestResponse('Question not found');
    }

    let progress = await getExistingProgress(userId, questionId);
    if (!progress) {
      progress = createInitialProgress(
        userId,
        questionId,
        topic || question.topic,
        subtopic || question.subtopic,
        question.difficulty
      );
    }

    const confidence = convertLegacyToConfidence(status, answeredCorrectly);
    const updatedProgress = updateProgressAfterAttempt(
      progress,
      answeredCorrectly,
      confidence,
      0
    );

    await saveProgress(updatedProgress);

    return successResponse({
      message: 'Progress saved',
      nextReviewDate: updatedProgress.sm2.nextReviewDate,
      newInterval: updatedProgress.sm2.interval,
      userStatus: updatedProgress.userStatus,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to save progress');
  }
};
