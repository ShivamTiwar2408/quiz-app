import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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
} as const;

export class QuizAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = this.createUserPool();
    const userPoolClient = this.createUserPoolClient(userPool);
    const userProgressTable = this.createDynamoTable();
    const lambdas = this.createLambdaFunctions(userProgressTable);
    const api = this.createApiGateway(userPool, lambdas);
    const { bucket, distribution } = this.createFrontendInfrastructure();

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

  private createLambdaFunctions(table: dynamodb.Table) {
    const lambdaDir = path.join(__dirname, '../lambda');
    const tableEnv = { TABLE_NAME: table.tableName };

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

    // Grant permissions - Principle of Least Privilege
    table.grantReadData(getQuestions);
    table.grantReadWriteData(saveProgress);
    table.grantReadData(getProgress);

    return { getTopics, getQuestions, saveProgress, getProgress };
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
      method: 'GET' | 'POST';
      lambda: NodejsFunction;
    }> = [
      { path: 'topics', method: 'GET', lambda: lambdas.getTopics },
      { path: 'questions', method: 'GET', lambda: lambdas.getQuestions },
      { path: 'progress', method: 'GET', lambda: lambdas.getProgress },
      { path: 'progress', method: 'POST', lambda: lambdas.saveProgress },
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
