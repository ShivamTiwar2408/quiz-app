# System Design Quiz App

A React-based quiz application for testing system design knowledge, deployed with AWS CDK (API Gateway, Lambda, DynamoDB, CloudFront).

## Architecture

- **Frontend**: React app hosted on S3 + CloudFront
- **Backend**: API Gateway + Lambda functions
- **Database**: DynamoDB for user progress tracking

## Local Development

```bash
npm install
npm start
```

## Deployment

### Prerequisites
- AWS CLI configured
- Node.js 18+
- CDK CLI (`npm install -g aws-cdk`)

### Deploy

```bash
# Build frontend
npm run build

# Deploy infrastructure
cd infrastructure
npm install
cdk bootstrap  # First time only
cdk deploy
```

### Environment Variables

Create `.env` file for local development with API:
```
REACT_APP_API_URL=https://your-api-gateway-url
```

## API Endpoints

- `GET /questions?count=10` - Get random questions
- `GET /progress` - Get user progress
- `POST /progress` - Save user progress

## Features

- Random quiz generation (10 questions)
- Multiple choice and multi-select questions
- Progress tracking (Remind Me / I Know This)
- Review mode for marked questions
- New questions mode for unseen content
