import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from './shared/db';
import { getUserId } from './shared/auth';
import { successResponse, errorResponse } from './shared/response';
import { TopicsMap } from './shared/types';
import topics from './topics.json';

interface CustomQuestion {
  topic: string;
  subtopic: string;
}

async function fetchCustomQuestionTopics(userId: string): Promise<Map<string, Set<string>>> {
  const tableName = process.env.CUSTOM_QUESTIONS_TABLE;
  if (!tableName) return new Map();

  try {
    const docClient = getDocClient();
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ProjectionExpression: 'topic, subtopic',
    }));

    const topicsMap = new Map<string, Set<string>>();
    for (const item of (result.Items || []) as CustomQuestion[]) {
      if (!topicsMap.has(item.topic)) {
        topicsMap.set(item.topic, new Set());
      }
      topicsMap.get(item.topic)!.add(item.subtopic);
    }
    return topicsMap;
  } catch (error) {
    console.error('Error fetching custom question topics:', error);
    return new Map();
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    
    // Start with base topics
    const mergedTopics: TopicsMap = { ...(topics as TopicsMap) };
    
    // Fetch custom question topics for this user
    const customTopics = await fetchCustomQuestionTopics(userId);
    
    // Merge custom topics into the result
    for (const [topic, subtopics] of customTopics) {
      if (mergedTopics[topic]) {
        // Topic exists - add any new subtopics
        const existingSubtopics = new Set(mergedTopics[topic]);
        for (const subtopic of subtopics) {
          if (!existingSubtopics.has(subtopic)) {
            mergedTopics[topic] = [...mergedTopics[topic], subtopic];
          }
        }
      } else {
        // New topic from custom questions
        mergedTopics[topic] = Array.from(subtopics);
      }
    }
    
    // Sort topics alphabetically, with custom-only topics marked
    const sortedTopics: TopicsMap = {};
    const sortedKeys = Object.keys(mergedTopics).sort();
    for (const key of sortedKeys) {
      sortedTopics[key] = mergedTopics[key].sort();
    }

    return successResponse({ topics: sortedTopics });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error');
  }
};
