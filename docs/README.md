# Recallr - System Design Interview Prep App

A spaced repetition quiz application for mastering system design concepts, built with React and AWS serverless infrastructure.

## Live Application

- **URL**: https://d2sa2ctd5invsq.cloudfront.net
- **API**: https://fwge4gqlr7.execute-api.us-east-1.amazonaws.com/prod/

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture Overview](./ARCHITECTURE.md) | High-level system architecture and component interactions |
| [SM-2 Algorithm](./SM2-ALGORITHM.md) | Spaced repetition algorithm implementation details |
| [Data Model](./DATA-MODEL.md) | DynamoDB tables, schemas, and indexes |
| [API Reference](./API-REFERENCE.md) | REST API endpoints and request/response formats |
| [Frontend Guide](./FRONTEND.md) | React components, hooks, and state management |
| [Deployment Guide](./DEPLOYMENT.md) | CDK infrastructure and deployment procedures |

## Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured with profile `ShivamTiwari2408`
- AWS CDK CLI

### Local Development
```bash
npm install
npm start
```

### Deploy Infrastructure
```bash
cd infrastructure
npm install
npx cdk deploy --profile ShivamTiwari2408
```

### Deploy Frontend
```bash
npm run build
aws s3 sync build/ s3://quizappstack-websitebucket75c24d94-deol4ncerkge/ --delete --profile ShivamTiwari2408
aws cloudfront create-invalidation --distribution-id ERF50ZOUSOA4M --paths "/*" --profile ShivamTiwari2408
```

## Key Features

- **SM-2 Spaced Repetition**: Intelligent scheduling based on performance and confidence
- **5 Quiz Modes**: Adaptive, Spaced Review, Topic Focused, Weak Area, Exam Prep
- **Confidence Feedback**: 0-5 rating system for calibrated learning
- **Analytics Dashboard**: Track progress, streaks, and topic mastery
- **Custom Questions**: Create and manage your own questions
- **Notes System**: Pin notes and generate quizzes from them
- **PWA Support**: Offline-capable with service worker caching

## Tech Stack

- **Frontend**: React 18, TypeScript, CSS
- **Backend**: AWS Lambda (Node.js 20), API Gateway, Cognito
- **Database**: DynamoDB (5 tables, 5 GSIs)
- **Hosting**: S3 + CloudFront
- **IaC**: AWS CDK v2
