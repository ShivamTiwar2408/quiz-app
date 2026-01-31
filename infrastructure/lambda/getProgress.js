const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-User-Id',
  };

  try {
    const userId = event.headers['x-user-id'] || event.headers['X-User-Id'] || 'anonymous';

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    }));

    const progress = {};
    for (const item of result.Items || []) {
      progress[item.questionId] = {
        questionId: item.questionId,
        status: item.status,
        answeredCorrectly: item.answeredCorrectly,
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ progress }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get progress' }),
    };
  }
};
