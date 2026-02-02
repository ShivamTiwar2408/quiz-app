import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

// Configuration constants - Single source of truth
const LAMBDA_CONFIG = {
  runtime: Runtime.NODEJS_20_X,
  timeout: cdk.Duration.seconds(10),
  bundling: { minify: true, sourceMap: true },
} as const;

// Force Lambda redeployment when questions are updated
const DEPLOYMENT_VERSION = '2026-02-01-v2';

const MEMORY_SIZES = {
  SMALL: 256,
  MEDIUM: 512,
  LARGE: 1024,
} as const;

export class QuizAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = this.createUserPool();
    const userPoolClient = this.createUserPoolClient(userPool);
    const userProgressTable = this.createDynamoTable();
    const notesTable = this.createNotesTable();
    const noteQuestionsTable = this.createNoteQuestionsTable();
    const lambdas = this.createLambdaFunctions(userProgressTable, notesTable, noteQuestionsTable);
    const api = this.createApiGateway(userPool, lambdas);
    const { bucket, distribution } = this.createFrontendInfrastructure();
    
    // Create EventBridge rule for daily question generation
    this.createDailyQuestionGenerationRule(lambdas.generateNoteQuestions);

    this.createOutputs(api, distribution, userPool, userPoolClient);
  }

  private createUserPool(): cognito.UserPool {
    return new cognito.UserPool(this, 'QuizUserPool', {
      userPoolName: 'quiz-app-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createUserPoolClient(userPool: cognito.UserPool): cognito.UserPoolClient {
    return new cognito.UserPoolClient(this, 'QuizUserPoolClient', {
      userPool,
      userPoolClientName: 'quiz-app-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });
  }

  private createDynamoTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'UserProgressTable', {
      tableName: 'QuizUserProgress',
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

  private createNotesTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'NotesTable', {
      tableName: 'QuizUserNotes',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'noteId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'TopicIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'topic', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'QuestionIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    return table;
  }

  private createNoteQuestionsTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'NoteQuestionsTable', {
      tableName: 'QuizNoteQuestions',
      partitionKey: { name: 'noteId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI to query by owner (userId)
    table.addGlobalSecondaryIndex({
      indexName: 'OwnerIndex',
      partitionKey: { name: 'ownerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'generatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    return table;
  }

  private createLambdaFunction(
    id: string,
    entry: string,
    memorySize: number,
    environment?: Record<string, string>
  ): NodejsFunction {
    const props: NodejsFunctionProps = {
      ...LAMBDA_CONFIG,
      entry,
      handler: 'handler',
      memorySize,
      environment,
    };
    return new NodejsFunction(this, id, props);
  }

  private createLambdaFunctions(table: dynamodb.Table, notesTable: dynamodb.Table, noteQuestionsTable: dynamodb.Table) {
    const lambdaDir = path.join(__dirname, '../lambda');
    const tableEnv = { TABLE_NAME: table.tableName };
    const notesEnv = { NOTES_TABLE_NAME: notesTable.tableName };
    const noteQuestionsEnv = { NOTE_QUESTIONS_TABLE_NAME: noteQuestionsTable.tableName };

    const getTopics = this.createLambdaFunction(
      'GetTopicsLambda',
      path.join(lambdaDir, 'getTopics.ts'),
      MEMORY_SIZES.SMALL
    );

    const getQuestions = this.createLambdaFunction(
      'GetQuestionsLambda',
      path.join(lambdaDir, 'getQuestions.ts'),
      MEMORY_SIZES.MEDIUM,
      { ...tableEnv, DEPLOYMENT_VERSION }
    );

    const saveProgress = this.createLambdaFunction(
      'SaveProgressLambda',
      path.join(lambdaDir, 'saveProgress.ts'),
      MEMORY_SIZES.SMALL,
      tableEnv
    );

    const getProgress = this.createLambdaFunction(
      'GetProgressLambda',
      path.join(lambdaDir, 'getProgress.ts'),
      MEMORY_SIZES.SMALL,
      tableEnv
    );

    const getNotes = this.createLambdaFunction(
      'GetNotesLambda',
      path.join(lambdaDir, 'getNotes.ts'),
      MEMORY_SIZES.SMALL,
      notesEnv
    );

    const saveNote = this.createLambdaFunction(
      'SaveNoteLambda',
      path.join(lambdaDir, 'saveNote.ts'),
      MEMORY_SIZES.SMALL,
      notesEnv
    );

    const deleteNote = this.createLambdaFunction(
      'DeleteNoteLambda',
      path.join(lambdaDir, 'deleteNote.ts'),
      MEMORY_SIZES.SMALL,
      notesEnv
    );

    // Lambda for generating questions from notes (triggered by EventBridge)
    const generateNoteQuestions = new NodejsFunction(this, 'GenerateNoteQuestionsLambda', {
      ...LAMBDA_CONFIG,
      entry: path.join(lambdaDir, 'generateNoteQuestions.ts'),
      handler: 'handler',
      memorySize: MEMORY_SIZES.LARGE,
      timeout: cdk.Duration.minutes(5), // Longer timeout for batch processing
      environment: {
        ...notesEnv,
        ...noteQuestionsEnv,
      },
    });

    // Lambda for fetching note-generated questions
    const getNoteQuestions = this.createLambdaFunction(
      'GetNoteQuestionsLambda',
      path.join(lambdaDir, 'getNoteQuestions.ts'),
      MEMORY_SIZES.SMALL,
      noteQuestionsEnv
    );

    // Grant Bedrock permissions to generateNoteQuestions Lambda
    generateNoteQuestions.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0'],
    }));

    // Grant permissions - Principle of Least Privilege
    table.grantReadData(getQuestions);
    table.grantReadWriteData(saveProgress);
    table.grantReadData(getProgress);
    
    notesTable.grantReadData(getNotes);
    notesTable.grantReadWriteData(saveNote);
    notesTable.grantReadWriteData(deleteNote);
    notesTable.grantReadData(generateNoteQuestions);
    
    noteQuestionsTable.grantReadWriteData(generateNoteQuestions);
    noteQuestionsTable.grantReadData(getNoteQuestions);

    return { getTopics, getQuestions, saveProgress, getProgress, getNotes, saveNote, deleteNote, generateNoteQuestions, getNoteQuestions };
  }

  private createApiGateway(
    userPool: cognito.UserPool,
    lambdas: ReturnType<typeof this.createLambdaFunctions>
  ): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'QuizApi', {
      restApiName: 'Quiz API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
      },
    });

    // Add CORS headers to 4XX/5XX responses (including 401 from Cognito authorizer)
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

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'QuizApiAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    const authConfig = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // Define routes - Open/Closed Principle: easy to add new routes
    const routes: Array<{
      path: string;
      method: 'GET' | 'POST' | 'DELETE';
      lambda: NodejsFunction;
    }> = [
      { path: 'topics', method: 'GET', lambda: lambdas.getTopics },
      { path: 'questions', method: 'GET', lambda: lambdas.getQuestions },
      { path: 'progress', method: 'GET', lambda: lambdas.getProgress },
      { path: 'progress', method: 'POST', lambda: lambdas.saveProgress },
      { path: 'notes', method: 'GET', lambda: lambdas.getNotes },
      { path: 'notes', method: 'POST', lambda: lambdas.saveNote },
      { path: 'note-questions', method: 'GET', lambda: lambdas.getNoteQuestions },
    ];

    // Group routes by path to handle multiple methods on same resource
    const resources = new Map<string, apigateway.Resource>();
    for (const route of routes) {
      if (!resources.has(route.path)) {
        resources.set(route.path, api.root.addResource(route.path));
      }
      resources.get(route.path)!.addMethod(
        route.method,
        new apigateway.LambdaIntegration(route.lambda),
        authConfig
      );
    }

    // Add DELETE /notes/{noteId} route
    const notesResource = resources.get('notes')!;
    const noteIdResource = notesResource.addResource('{noteId}');
    noteIdResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(lambdas.deleteNote),
      authConfig
    );

    return api;
  }

  private createDailyQuestionGenerationRule(lambda: NodejsFunction): void {
    // Run daily at 2 AM UTC
    new events.Rule(this, 'DailyNoteQuestionGeneration', {
      ruleName: 'recallr-daily-note-question-generation',
      description: 'Triggers daily generation of quiz questions from user notes',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        day: '*',
        month: '*',
        year: '*',
      }),
      targets: [new targets.LambdaFunction(lambda)],
    });
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
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL',
    });
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });
  }
}
