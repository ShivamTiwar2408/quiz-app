const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

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
    const body = JSON.parse(event.body);

    if (Array.isArray(body.progress)) {
      // Batch save multiple progress items
      const items = body.progress.map(item => ({
        PutRequest: {
          Item: {
            userId,
            questionId: item.questionId,
            status: item.status,
            answeredCorrectly: item.answeredCorrectly,
            timestamp: new Date().toISOString(),
          },
        },
      }));

      // DynamoDB batch write limit is 25 items
      const batches = [];
      for (let i = 0; i < items.length; i += 25) {
        batches.push(items.slice(i, i + 25));
      }

      for (const batch of batches) {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        }));
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Progress saved', count: items.length }),
      };
    } else {
      // Single item save
      const { questionId, status, answeredCorrectly } = body;

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          userId,
          questionId,
          status,
          answeredCorrectly,
          timestamp: new Date().toISOString(),
        },
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Progress saved' }),
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to save progress' }),
    };
  }
};
