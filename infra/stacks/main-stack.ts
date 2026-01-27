import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import * as path from 'path';

export class GetTrainMateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get Cognito User Pool ID from environment or use existing
    const userPoolId = this.node.tryGetContext('userPoolId') || process.env.COGNITO_USER_POOL_ID;
    const userPoolClientId = this.node.tryGetContext('userPoolClientId') || process.env.COGNITO_CLIENT_ID;

    // Reference existing Cognito User Pool (or create new one if needed)
    let userPool: cognito.IUserPool;
    if (userPoolId) {
      userPool = cognito.UserPool.fromUserPoolId(this, 'UserPool', userPoolId);
    } else {
      // Create new User Pool if one doesn't exist
      userPool = new cognito.UserPool(this, 'UserPool', {
        userPoolName: 'gettrainmate-users',
        signInAliases: {
          email: true,
          username: true,
        },
        autoVerify: {
          email: true,
        },
        standardAttributes: {
          email: {
            required: true,
            mutable: true,
          },
          givenName: {
            required: true,
            mutable: true,
          },
        },
        passwordPolicy: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: false,
        },
      });

      // Create User Pool Client
      new cognito.UserPoolClient(this, 'UserPoolClient', {
        userPool,
        userPoolClientName: 'gettrainmate-web-client',
        generateSecret: false,
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
      });
    }

    // DynamoDB Tables
    const tables = this.createDynamoDBTables();

    // S3 Bucket for media storage
    const mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `gettrainmate-media-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    // Lambda function for API
    // Note: The Lambda code needs to be built and published first:
    // cd apps/api && dotnet publish -c Release
    const apiLambda = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.DOTNET_6,
      handler: 'GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/api/bin/Release/net8.0/publish')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        // AWS_REGION is automatically set by Lambda runtime
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        DYNAMODB_TABLE_PREFIX: 'gettrainmate-',
        MEDIA_BUCKET_NAME: mediaBucket.bucketName,
      },
    });

    // Grant Lambda permissions
    tables.forEach(table => {
      table.grantReadWriteData(apiLambda);
    });
    mediaBucket.grantReadWrite(apiLambda);

    // Grant Lambda access to Cognito
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Grant Lambda access to Secrets Manager
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:gettrainmate/*`],
    }));

    // API Gateway HTTP API
    const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: 'gettrainmate-api',
      description: 'GetTrainMate API Gateway',
      corsPreflight: {
        allowOrigins: ['*'], // In production, restrict this to your domain
        allowMethods: [apigateway.CorsHttpMethod.GET, apigateway.CorsHttpMethod.POST, apigateway.CorsHttpMethod.PUT, apigateway.CorsHttpMethod.DELETE],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigatewayIntegrations.HttpLambdaIntegration('LambdaIntegration', apiLambda);

    // Add routes
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url!,
      description: 'API Gateway URL',
      exportName: 'GetTrainMateApiUrl',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'GetTrainMateUserPoolId',
    });

    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: mediaBucket.bucketName,
      description: 'S3 Media Bucket Name',
      exportName: 'GetTrainMateMediaBucket',
    });
  }

  private createDynamoDBTables(): dynamodb.Table[] {
    const tables: dynamodb.Table[] = [];

    // Users table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'gettrainmate-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(usersTable);

    // Profiles table
    const profilesTable = new dynamodb.Table(this, 'ProfilesTable', {
      tableName: 'gettrainmate-profiles',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(profilesTable);

    // Matches table
    const matchesTable = new dynamodb.Table(this, 'MatchesTable', {
      tableName: 'gettrainmate-matches',
      partitionKey: { name: 'matchId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    matchesTable.addGlobalSecondaryIndex({
      indexName: 'userId1-index',
      partitionKey: { name: 'userId1', type: dynamodb.AttributeType.STRING },
    });
    matchesTable.addGlobalSecondaryIndex({
      indexName: 'userId2-index',
      partitionKey: { name: 'userId2', type: dynamodb.AttributeType.STRING },
    });
    tables.push(matchesTable);

    // Messages table
    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      tableName: 'gettrainmate-messages',
      partitionKey: { name: 'threadId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(messagesTable);

    // Events table
    const eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: 'gettrainmate-events',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(eventsTable);

    // Content table (CMS)
    const contentTable = new dynamodb.Table(this, 'ContentTable', {
      tableName: 'gettrainmate-content',
      partitionKey: { name: 'contentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(contentTable);

    // Translations table
    const translationsTable = new dynamodb.Table(this, 'TranslationsTable', {
      tableName: 'gettrainmate-translations',
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    translationsTable.addGlobalSecondaryIndex({
      indexName: 'locale-index',
      partitionKey: { name: 'locale', type: dynamodb.AttributeType.STRING },
    });
    tables.push(translationsTable);

    // Entitlements table
    const entitlementsTable = new dynamodb.Table(this, 'EntitlementsTable', {
      tableName: 'gettrainmate-entitlements',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(entitlementsTable);

    // Leads table
    const leadsTable = new dynamodb.Table(this, 'LeadsTable', {
      tableName: 'gettrainmate-leads',
      partitionKey: { name: 'leadId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(leadsTable);

    // Audit log table
    const auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
      tableName: 'gettrainmate-audit-log',
      partitionKey: { name: 'logId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    tables.push(auditLogTable);

    return tables;
  }
}
