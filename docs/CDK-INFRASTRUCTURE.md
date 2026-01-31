# CDK Infrastructure

## Stack Overview

The entire infrastructure is defined in a single CDK stack (`QuizAppStack`) located at `infrastructure/lib/quiz-app-stack.ts`.

## Resources Created

### 1. DynamoDB Table

```typescript
const userProgressTable = new dynamodb.Table(this, 'UserProgressTable', {
  tableName: 'QuizUserProgress',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // On-demand pricing
  removalPolicy: cdk.RemovalPolicy.DESTROY,           // Delete on stack destroy
});
```

**Why this design?**
- Partition key `userId` groups all progress for one user
- Sort key `questionId` allows efficient queries for specific questions
- PAY_PER_REQUEST scales automatically with no capacity planning

### 2. Lambda Functions

```typescript
// Questions API - no database access needed
const getQuestionsLambda = new lambda.Function(this, 'GetQuestionsLambda', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'getQuestions.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
  timeout: cdk.Duration.seconds(10),
  memorySize: 256,
});

// Progress APIs - need DynamoDB access
const saveProgressLambda = new lambda.Function(this, 'SaveProgressLambda', {
  // ... same config ...
  environment: {
    TABLE_NAME: userProgressTable.tableName,  // Inject table name
  },
});

// Grant permissions
userProgressTable.grantReadWriteData(saveProgressLambda);
userProgressTable.grantReadData(getProgressLambda);
```

### 3. API Gateway

```typescript
const api = new apigateway.RestApi(this, 'QuizApi', {
  restApiName: 'Quiz API',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
  },
});

// Route configuration
const questionsResource = api.root.addResource('questions');
questionsResource.addMethod('GET', new apigateway.LambdaIntegration(getQuestionsLambda));

const progressResource = api.root.addResource('progress');
progressResource.addMethod('GET', new apigateway.LambdaIntegration(getProgressLambda));
progressResource.addMethod('POST', new apigateway.LambdaIntegration(saveProgressLambda));
```

### 4. S3 Bucket (Frontend Hosting)

```typescript
const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,  // No direct public access
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,  // Clean up on stack destroy
});
```

### 5. CloudFront Distribution

```typescript
const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
websiteBucket.grantRead(originAccessIdentity);  // Only CloudFront can read S3

const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(websiteBucket, { originAccessIdentity }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
  },
  defaultRootObject: 'index.html',
  errorResponses: [
    // SPA routing - return index.html for 404/403
    { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
    { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
  ],
});
```

### 6. S3 Deployment

```typescript
new s3deploy.BucketDeployment(this, 'DeployWebsite', {
  sources: [s3deploy.Source.asset(path.join(__dirname, '../../build'))],
  destinationBucket: websiteBucket,
  distribution,
  distributionPaths: ['/*'],  // Invalidate CloudFront cache on deploy
});
```

## Deployment Commands

```bash
# First time setup
cd infrastructure
npm install
cdk bootstrap --profile YOUR_PROFILE

# Deploy
npm run build  # Build React app first (from root)
cd infrastructure
cdk deploy --profile YOUR_PROFILE

# Destroy (removes all resources)
cdk destroy --profile YOUR_PROFILE
```

## Stack Outputs

After deployment, CDK outputs:

```
QuizAppStack.ApiUrl = https://xxx.execute-api.us-east-1.amazonaws.com/prod/
QuizAppStack.CloudFrontUrl = https://xxx.cloudfront.net
```

## Cost Considerations

| Service | Pricing Model |
|---------|---------------|
| Lambda | Pay per invocation (~$0.20/million requests) |
| DynamoDB | Pay per request (~$1.25/million writes) |
| API Gateway | $3.50/million requests |
| CloudFront | $0.085/GB data transfer |
| S3 | $0.023/GB storage |

For a quiz app with moderate traffic, expect < $5/month.
