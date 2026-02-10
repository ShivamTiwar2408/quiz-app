import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

const LAMBDA_CONFIG = {
  runtime: Runtime.NODEJS_20_X,
  timeout: cdk.Duration.seconds(10),
  bundling: { minify: true, sourceMap: true },
} as const;

const DEPLOYMENT_VERSION = '2026-02-10-analytics-v1';
const MEMORY_SIZES = { SMALL: 256, MEDIUM: 512, LARGE: 1024 } as const;

export class QuizAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const userPool = this.createUserPool();
    const userPoolClient = this.createUserPoolClient(userPool);
    const progressTable = this.createProgressTable();
    const attemptsTable = this.createAttemptsTable();
    const sessionsTable = this.createSessionsTable();
    const notesTable = this.createNotesTable();
    const customQuestionsTable = this.createCustomQuestionsTable();
    const lambdas = this.createLambdaFunctions(progressTable, attemptsTable, sessionsTable, notesTable, customQuestionsTable);
    const api = this.createApiGateway(userPool, lambdas);
    const { distribution } = this.createFrontendInfrastructure();
    this.createOutputs(api, distribution, userPool, userPoolClient);
  }

  private createUserPool(): cognito.UserPool {
    return new cognito.UserPool(this, 'QuizUserPool', {
      userPoolName: 'recallr-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createUserPoolClient(userPool: cognito.UserPool): cognito.UserPoolClient {
    return new cognito.UserPoolClient(this, 'QuizUserPoolClient', {
      userPool,
      userPoolClientName: 'recallr-client',
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });
  }

  private createProgressTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'ProgressTable', {
      tableName: 'RecallrProgress',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'ReviewDateIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'nextReviewDate', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'TopicIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'topic', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userStatus', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    return table;
  }

  private createAttemptsTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'AttemptsTable', {
      tableName: 'RecallrAttempts',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'attemptId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });
    table.addGlobalSecondaryIndex({
      indexName: 'QuestionIndex',
      partitionKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'attemptedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    return table;
  }

  private createSessionsTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'RecallrSessions',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });
  }

  private createNotesTable(): dynamodb.Table {
    return new dynamodb.Table(this, 'NotesTable', {
      tableName: 'RecallrNotes',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'noteId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createCustomQuestionsTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'CustomQuestionsTable', {
      tableName: 'RecallrCustomQuestions',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'TopicIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'topic', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    return table;
  }

  private createLambdaFunction(id: string, entry: string, memorySize: number, environment?: Record<string, string>): NodejsFunction {
    return new NodejsFunction(this, id, {
      ...LAMBDA_CONFIG,
      entry,
      handler: 'handler',
      memorySize,
      environment,
    });
  }

  private createLambdaFunctions(
    progressTable: dynamodb.Table,
    attemptsTable: dynamodb.Table,
    sessionsTable: dynamodb.Table,
    notesTable: dynamodb.Table,
    customQuestionsTable: dynamodb.Table
  ) {
    const lambdaDir = path.join(__dirname, '../lambda');
    const commonEnv = {
      PROGRESS_TABLE: progressTable.tableName,
      ATTEMPTS_TABLE: attemptsTable.tableName,
      SESSIONS_TABLE: sessionsTable.tableName,
      CUSTOM_QUESTIONS_TABLE: customQuestionsTable.tableName,
      DEPLOYMENT_VERSION,
    };
    const notesEnv = { NOTES_TABLE: notesTable.tableName };

    const getTopics = this.createLambdaFunction('GetTopicsLambda', path.join(lambdaDir, 'getTopics.ts'), MEMORY_SIZES.SMALL);
    const generateQuiz = this.createLambdaFunction('GenerateQuizLambda', path.join(lambdaDir, 'generateQuiz.ts'), MEMORY_SIZES.MEDIUM, commonEnv);
    const submitAnswer = this.createLambdaFunction('SubmitAnswerLambda', path.join(lambdaDir, 'submitAnswer.ts'), MEMORY_SIZES.SMALL, commonEnv);
    const getProgress = this.createLambdaFunction('GetProgressLambda', path.join(lambdaDir, 'getProgress.ts'), MEMORY_SIZES.SMALL, commonEnv);
    const getStats = this.createLambdaFunction('GetStatsLambda', path.join(lambdaDir, 'getStats.ts'), MEMORY_SIZES.SMALL, commonEnv);
    const getAttempts = this.createLambdaFunction('GetAttemptsLambda', path.join(lambdaDir, 'getAttempts.ts'), MEMORY_SIZES.SMALL, commonEnv);
    const getSessions = this.createLambdaFunction('GetSessionsLambda', path.join(lambdaDir, 'getSessions.ts'), MEMORY_SIZES.SMALL, commonEnv);
    const getAnalytics = this.createLambdaFunction('GetAnalyticsLambda', path.join(lambdaDir, 'getAnalytics.ts'), MEMORY_SIZES.MEDIUM, commonEnv);
    const manageQuestions = this.createLambdaFunction('ManageQuestionsLambda', path.join(lambdaDir, 'manageQuestions.ts'), MEMORY_SIZES.SMALL, { CUSTOM_QUESTIONS_TABLE: customQuestionsTable.tableName });
    const getNotes = this.createLambdaFunction('GetNotesLambda', path.join(lambdaDir, 'getNotes.ts'), MEMORY_SIZES.SMALL, notesEnv);
    const saveNote = this.createLambdaFunction('SaveNoteLambda', path.join(lambdaDir, 'saveNote.ts'), MEMORY_SIZES.SMALL, notesEnv);
    const deleteNote = this.createLambdaFunction('DeleteNoteLambda', path.join(lambdaDir, 'deleteNote.ts'), MEMORY_SIZES.SMALL, notesEnv);

    progressTable.grantReadWriteData(generateQuiz);
    progressTable.grantReadWriteData(submitAnswer);
    progressTable.grantReadData(getProgress);
    progressTable.grantReadData(getStats);
    progressTable.grantReadData(getAnalytics);
    attemptsTable.grantReadWriteData(submitAnswer);
    attemptsTable.grantReadData(getStats);
    attemptsTable.grantReadData(getAttempts);
    attemptsTable.grantReadData(getAnalytics);
    sessionsTable.grantReadWriteData(generateQuiz);
    sessionsTable.grantReadData(getSessions);
    sessionsTable.grantReadData(getAnalytics);
    customQuestionsTable.grantReadWriteData(manageQuestions);
    customQuestionsTable.grantReadData(generateQuiz);
    notesTable.grantReadData(getNotes);
    notesTable.grantReadWriteData(saveNote);
    notesTable.grantReadWriteData(deleteNote);

    return { getTopics, generateQuiz, submitAnswer, getProgress, getStats, getAttempts, getSessions, getAnalytics, manageQuestions, getNotes, saveNote, deleteNote };
  }

  private createApiGateway(userPool: cognito.UserPool, lambdas: ReturnType<typeof this.createLambdaFunctions>): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'RecallrApi', {
      restApiName: 'Recallr API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
      },
    });

    api.addGatewayResponse('UnauthorizedResponse', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-User-Id'",
      },
    });
    api.addGatewayResponse('Default4XXResponse', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-User-Id'",
      },
    });
    api.addGatewayResponse('Default5XXResponse', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-User-Id'",
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });
    const authConfig = { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO };

    // Routes
    api.root.addResource('topics').addMethod('GET', new apigateway.LambdaIntegration(lambdas.getTopics), authConfig);
    
    const quiz = api.root.addResource('quiz');
    quiz.addResource('generate').addMethod('POST', new apigateway.LambdaIntegration(lambdas.generateQuiz), authConfig);
    quiz.addResource('submit').addMethod('POST', new apigateway.LambdaIntegration(lambdas.submitAnswer), authConfig);
    
    api.root.addResource('progress').addMethod('GET', new apigateway.LambdaIntegration(lambdas.getProgress), authConfig);
    api.root.addResource('stats').addMethod('GET', new apigateway.LambdaIntegration(lambdas.getStats), authConfig);
    api.root.addResource('attempts').addMethod('GET', new apigateway.LambdaIntegration(lambdas.getAttempts), authConfig);
    api.root.addResource('sessions').addMethod('GET', new apigateway.LambdaIntegration(lambdas.getSessions), authConfig);
    api.root.addResource('analytics').addMethod('GET', new apigateway.LambdaIntegration(lambdas.getAnalytics), authConfig);
    
    // Custom questions CRUD
    const questions = api.root.addResource('questions');
    questions.addMethod('GET', new apigateway.LambdaIntegration(lambdas.manageQuestions), authConfig);
    questions.addMethod('POST', new apigateway.LambdaIntegration(lambdas.manageQuestions), authConfig);
    const questionById = questions.addResource('{questionId}');
    questionById.addMethod('PUT', new apigateway.LambdaIntegration(lambdas.manageQuestions), authConfig);
    questionById.addMethod('DELETE', new apigateway.LambdaIntegration(lambdas.manageQuestions), authConfig);
    
    const notes = api.root.addResource('notes');
    notes.addMethod('GET', new apigateway.LambdaIntegration(lambdas.getNotes), authConfig);
    notes.addMethod('POST', new apigateway.LambdaIntegration(lambdas.saveNote), authConfig);
    notes.addResource('{noteId}').addMethod('DELETE', new apigateway.LambdaIntegration(lambdas.deleteNote), authConfig);

    return api;
  }

  private createFrontendInfrastructure() {
    const bucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../build'))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    return { bucket, distribution };
  }

  private createOutputs(
    api: apigateway.RestApi,
    distribution: cloudfront.Distribution,
    userPool: cognito.UserPool,
    userPoolClient: cognito.UserPoolClient
  ) {
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url, description: 'API Gateway URL' });
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}`, description: 'CloudFront URL' });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId, description: 'Cognito User Pool ID' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId, description: 'Cognito User Pool Client ID' });
  }
}
