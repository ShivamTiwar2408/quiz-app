// Standardized response builder - DRY principle
import { APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS, HTTP_STATUS } from './constants';

export function successResponse<T>(data: T): APIGatewayProxyResult {
  return {
    statusCode: HTTP_STATUS.OK,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

export function errorResponse(
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_ERROR
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function badRequestResponse(message: string): APIGatewayProxyResult {
  return errorResponse(message, HTTP_STATUS.BAD_REQUEST);
}
