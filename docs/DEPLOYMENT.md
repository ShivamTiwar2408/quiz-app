# Deployment Guide

## Prerequisites

- Node.js 18+
- AWS CLI v2
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS credentials configured

## AWS Configuration

**Profile:** `ShivamTiwari2408`
**Region:** `us-east-1`

### Resources Created

| Resource | Name/ID |
|----------|---------|
| S3 Bucket | `quizappstack-websitebucket75c24d94-deol4ncerkge` |
| CloudFront | `ERF50ZOUSOA4M` |
| API Gateway | `fwge4gqlr7` |
| Cognito User Pool | `us-east-1_Suy4cgvUy` |
| Cognito Client | `3gmspqs073e366vr1t01sggdl6` |

### DynamoDB Tables

| Table | Purpose |
|-------|---------|
| RecallrProgress | SM-2 spaced repetition state |
| RecallrAttempts | Quiz attempt history |
| RecallrSessions | Quiz session records |
| RecallrNotes | User notes |
| RecallrCustomQuestions | User-created questions |

---

## CDK Infrastructure

### Stack Overview

```
infrastructure/
├── bin/
│   └── infrastructure.ts    # CDK app entry point
├── lib/
│   └── quiz-app-stack.ts    # Main stack definition
├── lambda/
│   ├── shared/              # Shared Lambda modules
│   ├── generateQuiz.ts
│   ├── submitAnswer.ts
│   ├── getTopics.ts
│   ├── getProgress.ts
│   ├── getStats.ts
│   ├── getAttempts.ts
│   ├── getSessions.ts
│   ├── getAnalytics.ts
│   ├── manageQuestions.ts
│   ├── getNotes.ts
│   ├── saveNote.ts
│   └── deleteNote.ts
├── cdk.json
├── package.json
└── tsconfig.json
```

### Deploy Infrastructure

```bash
cd infrastructure

# Install dependencies
npm install

# Synthesize CloudFormation template
npx cdk synth --profile ShivamTiwari2408

# Deploy (creates/updates all resources)
npx cdk deploy --require-approval never --profile ShivamTiwari2408

# View differences before deploy
npx cdk diff --profile ShivamTiwari2408
```

### Lambda Configuration

All Lambdas use:
- **Runtime:** Node.js 20.x
- **Timeout:** 10 seconds
- **Bundling:** esbuild with minification

Memory allocation:
| Lambda | Memory |
|--------|--------|
| getTopics | 256 MB |
| generateQuiz | 512 MB |
| submitAnswer | 256 MB |
| getProgress | 256 MB |
| getStats | 256 MB |
| getAttempts | 256 MB |
| getSessions | 256 MB |
| getAnalytics | 512 MB |
| manageQuestions | 256 MB |
| getNotes | 256 MB |
| saveNote | 256 MB |
| deleteNote | 256 MB |

---

## Frontend Deployment

### Build

```bash
# From project root
npm install
npm run build
```

### Deploy to S3

```bash
aws s3 sync build/ s3://quizappstack-websitebucket75c24d94-deol4ncerkge/ --delete --profile ShivamTiwari2408
```

### Invalidate CloudFront Cache

```bash
aws cloudfront create-invalidation \
  --distribution-id ERF50ZOUSOA4M \
  --paths "/*" \
  --profile ShivamTiwari2408
```

### Cache Busting

Before deploying, update the cache version in `public/service-worker.js`:

```javascript
const CACHE_VERSION = '2026-02-10-v4';  // Increment version
```

---

## Full Deployment Script

```bash
#!/bin/bash
set -e

PROFILE="ShivamTiwari2408"
S3_BUCKET="quizappstack-websitebucket75c24d94-deol4ncerkge"
CF_DIST="ERF50ZOUSOA4M"

echo "=== Deploying Infrastructure ==="
cd infrastructure
npm install
npx cdk deploy --require-approval never --profile $PROFILE
cd ..

echo "=== Building Frontend ==="
npm install
npm run build

echo "=== Deploying to S3 ==="
aws s3 sync build/ s3://$S3_BUCKET/ --delete --profile $PROFILE

echo "=== Invalidating CloudFront ==="
aws cloudfront create-invalidation \
  --distribution-id $CF_DIST \
  --paths "/*" \
  --profile $PROFILE

echo "=== Deployment Complete ==="
echo "URL: https://d2sa2ctd5invsq.cloudfront.net"
```

---

## Environment Variables

### Frontend (.env)

```bash
REACT_APP_API_URL=https://fwge4gqlr7.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_USER_POOL_ID=us-east-1_Suy4cgvUy
REACT_APP_USER_POOL_CLIENT_ID=3gmspqs073e366vr1t01sggdl6
REACT_APP_REGION=us-east-1
```

### Lambda Environment (set by CDK)

| Variable | Value |
|----------|-------|
| PROGRESS_TABLE | RecallrProgress |
| ATTEMPTS_TABLE | RecallrAttempts |
| SESSIONS_TABLE | RecallrSessions |
| NOTES_TABLE | RecallrNotes |
| CUSTOM_QUESTIONS_TABLE | RecallrCustomQuestions |
| DEPLOYMENT_VERSION | 2026-02-10-analytics-v1 |

---

## Troubleshooting

### CDK "No Changes" Issue

If CDK reports no changes but code was updated:

```bash
cd infrastructure
rm -rf cdk.out
rm -rf node_modules/.cache
npx cdk deploy --require-approval never --profile ShivamTiwari2408
```

### Lambda Not Updating

Force Lambda code update by changing `DEPLOYMENT_VERSION` in `quiz-app-stack.ts`:

```typescript
const DEPLOYMENT_VERSION = '2026-02-10-v2';  // Change this
```

### CloudFront Cache Issues

1. Update `CACHE_VERSION` in service worker
2. Rebuild frontend
3. Deploy to S3
4. Create CloudFront invalidation
5. Hard refresh browser (Cmd+Shift+R)

### CORS Errors

API Gateway CORS is configured for all origins. If issues persist:
1. Check API Gateway console for CORS settings
2. Verify Lambda returns proper CORS headers
3. Check browser network tab for preflight OPTIONS request

---

## Monitoring

### CloudWatch Logs

Each Lambda has its own log group:
- `/aws/lambda/QuizAppStack-GetTopicsLambda*`
- `/aws/lambda/QuizAppStack-GenerateQuizLambda*`
- etc.

### DynamoDB Metrics

Monitor in AWS Console:
- Read/Write capacity units
- Throttled requests
- Latency

### CloudFront Metrics

- Request count
- Error rate
- Cache hit ratio

---

## Cost Optimization

Current setup uses:
- **DynamoDB:** On-demand (pay per request)
- **Lambda:** Pay per invocation
- **S3:** Standard storage
- **CloudFront:** Standard distribution

Estimated monthly cost for moderate usage: ~$5-15
