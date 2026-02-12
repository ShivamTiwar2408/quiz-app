# Recallr - System Design Interview Prep

A React-based spaced repetition application for mastering system design concepts, deployed with AWS CDK (API Gateway, Lambda, DynamoDB, CloudFront).

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

- `GET /topics` - Get topic hierarchy
- `POST /quiz/generate` - Generate quiz session
- `POST /quiz/submit` - Submit answer
- `GET /progress` - Get user progress
- `GET /stats` - Get aggregated statistics
- `GET /analytics` - Get comprehensive analytics

## Features

- SM-2 Spaced Repetition algorithm
- 5 Quiz Modes: Adaptive, Spaced Review, Topic Focused, Weak Area, Exam Prep
- Confidence feedback (0-5 rating)
- Analytics dashboard
- Custom questions
- Notes system with quiz generation
- PWA support
