import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient, getTableName } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse, badRequestResponse } from './shared/response';
import { ProgressStatus } from './shared/types';

interface ProgressInput {
  questionId: string;
  topic: string;
  subtopic: string;
  status: ProgressStatus;
  answeredCorrectly: boolean;
}

interface SaveProgressBody {
  progress?: ProgressInput[];
  questionId?: string;
  topic?: string;
  subtopic?: string;
  status?: ProgressStatus;
  answeredCorrectly?: boolean;
}

async function updateSingleProgress(
  userId: string,
  questionId: string,
  topic: string,
  subtopic: string,
  status: ProgressStatus,
  answeredCorrectly: boolean
) {
  const docClient = getDocClient();
  const tableName = getTableName();
  const now = new Date().toISOString();

  return docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { userId, questionId },
    UpdateExpression:
      'SET #status = :status, ' +
      'answeredCorrectly = :answeredCorrectly, ' +
      'topic = :topic, ' +
      'subtopic = :subtopic, ' +
      'lastAnswered = :lastAnswered, ' +
      '#ts = :timestamp, ' +
      'wrongCount = if_not_exists(wrongCount, :zero) + :wrongInc, ' +
      'correctCount = if_not_exists(correctCount, :zero) + :correctInc, ' +
      'remindCount = if_not_exists(remindCount, :zero) + :remindInc, ' +
      'knownCount = if_not_exists(knownCount, :zero) + :knownInc',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#ts': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':answeredCorrectly': answeredCorrectly,
      ':topic': topic,
      ':subtopic': subtopic,
      ':lastAnswered': now,
      ':timestamp': now,
      ':zero': 0,
      ':wrongInc': !answeredCorrectly ? 1 : 0,
      ':correctInc': answeredCorrectly ? 1 : 0,
      ':remindInc': status === 'remind' ? 1 : 0,
      ':knownInc': status === 'known' ? 1 : 0,
    },
    ReturnValues: 'ALL_NEW',
  }));
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const body: SaveProgressBody = JSON.parse(event.body || '{}');

    // Batch update
    if (Array.isArray(body.progress)) {
      await Promise.all(
        body.progress.map(item =>
          updateSingleProgress(
            userId,
            item.questionId,
            item.topic,
            item.subtopic,
            item.status,
            item.answeredCorrectly
          )
        )
      );

      return successResponse({
        message: 'Progress saved',
        count: body.progress.length,
      });
    }

    // Single update - validate required fields
    const { questionId, topic, subtopic, status, answeredCorrectly } = body;

    if (!questionId || !status || answeredCorrectly === undefined) {
      return badRequestResponse('Missing required fields: questionId, status, answeredCorrectly');
    }

    const result = await updateSingleProgress(
      userId,
      questionId,
      topic || '',
      subtopic || '',
      status,
      answeredCorrectly
    );

    return successResponse({
      message: 'Progress saved',
      wrongCount: result.Attributes?.wrongCount,
      correctCount: result.Attributes?.correctCount,
      remindCount: result.Attributes?.remindCount,
      knownCount: result.Attributes?.knownCount,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Failed to save progress');
  }
};
