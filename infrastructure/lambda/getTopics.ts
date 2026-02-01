import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from './shared/response';
import { TopicsMap } from './shared/types';
import topics from './topics.json';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    return successResponse({ topics: topics as TopicsMap });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error');
  }
};
