# Quiz App Architecture

## Overview

This is a serverless quiz application for system design knowledge testing. The app uses a React frontend hosted on CloudFront/S3, with a Lambda-based API backend and DynamoDB for persistence.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CloudFront    │────▶│    S3 Bucket    │     │   API Gateway   │
│   Distribution  │     │  (React Build)  │     │    (REST API)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
               ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
               │  getQuestions   │              │  getProgress    │              │  saveProgress   │
               │    Lambda       │              │    Lambda       │              │    Lambda       │
               └─────────────────┘              └────────┬────────┘              └────────┬────────┘
                                                         │                                │
                                                         ▼                                ▼
                                                ┌─────────────────────────────────────────────────┐
                                                │              DynamoDB Table                     │
                                                │           (QuizUserProgress)                    │
                                                │   PK: userId    SK: questionId                  │
                                                └─────────────────────────────────────────────────┘
```

## AWS Services Used

| Service | Purpose |
|---------|---------|
| CloudFront | CDN for serving React app globally with low latency |
| S3 | Static hosting for compiled React build files |
| API Gateway | REST API endpoint with CORS support |
| Lambda | Serverless compute for business logic |
| DynamoDB | NoSQL database for user progress storage |

## Deployed URLs

- **Frontend**: https://d2sa2ctd5invsq.cloudfront.net
- **API**: https://8c1p8cvsb2.execute-api.us-east-1.amazonaws.com/prod/
