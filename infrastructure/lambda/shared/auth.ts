// Shared authentication utilities
import { APIGatewayProxyEvent } from 'aws-lambda';

export function getUserId(event: APIGatewayProxyEvent): string {
  // Get userId from Cognito authorizer claims (sub = user ID)
  const claims = event.requestContext?.authorizer?.claims;
  return (
    claims?.sub ||
    event.headers['x-user-id'] ||
    event.headers['X-User-Id'] ||
    'anonymous'
  );
}
