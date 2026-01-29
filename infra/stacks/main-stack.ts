import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as customResources from 'aws-cdk-lib/custom-resources';
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
    const adminTables = this.createAdminAndCRMTables();
    const contactsTables = this.createContactsTables();
    const tokenWalletTables = this.createTokenWalletTables();
    const allTables = [...tables, ...adminTables, ...contactsTables, ...tokenWalletTables];

    // S3 Bucket for media storage
    // Reference existing bucket
    const mediaBucket = s3.Bucket.fromBucketName(this, 'MediaBucket', 'getrainmate-media-bucket');
    
    // Add CORS configuration to the S3 bucket
    // Since we're referencing an existing bucket, we use a custom resource
    this.addS3CorsConfiguration(mediaBucket);

    // Lambda function for API
    // Note: The Lambda code needs to be built and published first:
    // cd apps/api && dotnet publish -c Release
    const apiLambda = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.DOTNET_8, // Use .NET 8 managed runtime
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
    allTables.forEach(table => {
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

    // Grant Lambda access to SES for email sending
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
      ],
      resources: ['*'], // SES doesn't support resource-level permissions for SendEmail
    }));

    // API Gateway HTTP API
    const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: 'gettrainmate-api',
      description: 'GetTrainMate API Gateway',
      corsPreflight: {
        allowOrigins: ['*'], // In production, restrict this to your domain
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS,
          apigateway.CorsHttpMethod.PATCH,
        ],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers',
        ],
        maxAge: cdk.Duration.days(1),
        allowCredentials: false,
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

  private createDynamoDBTables(): dynamodb.ITable[] {
    const tables: dynamodb.ITable[] = [];

    // Reference existing DynamoDB tables instead of creating new ones
    // Users table
    const usersTable = dynamodb.Table.fromTableName(this, 'UsersTable', 'gettrainmate-users');
    tables.push(usersTable);

    // Profiles table
    const profilesTable = dynamodb.Table.fromTableName(this, 'ProfilesTable', 'gettrainmate-profiles');
    tables.push(profilesTable);

    // Matches table
    const matchesTable = dynamodb.Table.fromTableName(this, 'MatchesTable', 'gettrainmate-matches');
    tables.push(matchesTable);

    // Messages table
    const messagesTable = dynamodb.Table.fromTableName(this, 'MessagesTable', 'gettrainmate-messages');
    tables.push(messagesTable);

    // Events table
    const eventsTable = dynamodb.Table.fromTableName(this, 'EventsTable', 'gettrainmate-events');
    tables.push(eventsTable);

    // Content table (CMS)
    const contentTable = dynamodb.Table.fromTableName(this, 'ContentTable', 'gettrainmate-content');
    tables.push(contentTable);

    // Translations table
    const translationsTable = dynamodb.Table.fromTableName(this, 'TranslationsTable', 'gettrainmate-translations');
    tables.push(translationsTable);

    // Entitlements table
    const entitlementsTable = dynamodb.Table.fromTableName(this, 'EntitlementsTable', 'gettrainmate-entitlements');
    tables.push(entitlementsTable);

    // Leads table
    const leadsTable = dynamodb.Table.fromTableName(this, 'LeadsTable', 'gettrainmate-leads');
    tables.push(leadsTable);

    // Audit log table
    const auditLogTable = dynamodb.Table.fromTableName(this, 'AuditLogTable', 'gettrainmate-audit-log');
    tables.push(auditLogTable);

    return tables;
  }

  private createAdminAndCRMTables(): dynamodb.ITable[] {
    const tables: dynamodb.ITable[] = [];

    // Admins table - for admin user management
    // Note: Table uses Email as partition key and AdminId as sort key
    const adminsTable = new dynamodb.Table(this, 'AdminsTable', {
      tableName: 'gettrainmate-admins',
      partitionKey: { name: 'Email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'AdminId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(adminsTable);

    // Payments table - for payment tracking
    // Note: Payment model uses PaymentId as partition key and UserId as sort key
    const paymentsTable = new dynamodb.Table(this, 'PaymentsTable', {
      tableName: 'gettrainmate-payments',
      partitionKey: { name: 'PaymentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    // Add GSI for querying payments by userId (without needing PaymentId)
    paymentsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    });
    tables.push(paymentsTable);

    // Subscriptions table - for subscription management and CRM
    const subscriptionsTable = new dynamodb.Table(this, 'SubscriptionsTable', {
      tableName: 'gettrainmate-subscriptions',
      partitionKey: { name: 'SubscriptionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: true,
    });
    subscriptionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    });
    subscriptionsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'Status', type: dynamodb.AttributeType.STRING },
    });
    tables.push(subscriptionsTable);

    // Support tickets table - for customer support CRM
    const supportTicketsTable = new dynamodb.Table(this, 'SupportTicketsTable', {
      tableName: 'gettrainmate-support-tickets',
      partitionKey: { name: 'TicketId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    supportTicketsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    });
    supportTicketsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'Status', type: dynamodb.AttributeType.STRING },
    });
    tables.push(supportTicketsTable);

    // Analytics/Usage tracking table - for admin analytics dashboard
    const analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
      tableName: 'gettrainmate-analytics',
      partitionKey: { name: 'EventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    analyticsTable.addGlobalSecondaryIndex({
      indexName: 'date-index',
      partitionKey: { name: 'Date', type: dynamodb.AttributeType.STRING },
    });
    analyticsTable.addGlobalSecondaryIndex({
      indexName: 'eventType-index',
      partitionKey: { name: 'EventType', type: dynamodb.AttributeType.STRING },
    });
    tables.push(analyticsTable);

    return tables;
  }

  private createContactsTables(): dynamodb.ITable[] {
    const tables: dynamodb.ITable[] = [];

    // Contacts table
    const contactsTable = new dynamodb.Table(this, 'ContactsTable', {
      tableName: 'gettrainmate-contacts',
      partitionKey: { name: 'ContactId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    contactsTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'Email', type: dynamodb.AttributeType.STRING },
    });
    tables.push(contactsTable);

    // Contact email threads table
    const threadsTable = new dynamodb.Table(this, 'ContactEmailThreadsTable', {
      tableName: 'gettrainmate-contact-email-threads',
      partitionKey: { name: 'ContactId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ThreadId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(threadsTable);

    // Contact email messages table
    const messagesTable = new dynamodb.Table(this, 'ContactEmailMessagesTable', {
      tableName: 'gettrainmate-contact-email-messages',
      partitionKey: { name: 'ThreadId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'MessageId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(messagesTable);

    return tables;
  }

  private createTokenWalletTables(): dynamodb.ITable[] {
    const tables: dynamodb.ITable[] = [];

    // Token wallets table
    const walletsTable = new dynamodb.Table(this, 'TokenWalletsTable', {
      tableName: 'gettrainmate-token-wallets',
      partitionKey: { name: 'WalletId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    walletsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    });
    walletsTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'Email', type: dynamodb.AttributeType.STRING },
    });
    tables.push(walletsTable);

    // Token ledger table
    const ledgerTable = new dynamodb.Table(this, 'TokenLedgerTable', {
      tableName: 'gettrainmate-token-ledger',
      partitionKey: { name: 'EntryId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    ledgerTable.addGlobalSecondaryIndex({
      indexName: 'walletId-index',
      partitionKey: { name: 'WalletId', type: dynamodb.AttributeType.STRING },
    });
    tables.push(ledgerTable);

    // Stripe customers table
    const stripeCustomersTable = new dynamodb.Table(this, 'StripeCustomersTable', {
      tableName: 'gettrainmate-stripe-customers',
      partitionKey: { name: 'StripeCustomerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    stripeCustomersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'Email', type: dynamodb.AttributeType.STRING },
    });
    tables.push(stripeCustomersTable);

    return tables;
  }

  /**
   * Add CORS configuration to the S3 bucket using a custom resource
   */
  private addS3CorsConfiguration(bucket: s3.IBucket): void {
    // Custom resource Lambda to set CORS configuration
    const corsLambda = new lambda.Function(this, 'S3CorsConfigLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import boto3
import cfnresponse
import json

def handler(event, context):
    s3_client = boto3.client('s3')
    bucket_name = '${bucket.bucketName}'
    
    cors_configuration = {
        'CORSRules': [
            {
                'AllowedOrigins': [
                    'https://main.d3tocp1533tn5q.amplifyapp.com',
                    'http://localhost:3000',
                    'http://localhost:5173',
                    'http://localhost:5174'
                ],
                'AllowedMethods': ['GET', 'PUT', 'POST', 'HEAD'],
                'AllowedHeaders': ['*'],
                'ExposeHeaders': ['ETag'],
                'MaxAgeSeconds': 3000
            }
        ]
    }
    
    try:
        if event['RequestType'] == 'Delete':
            # On delete, remove CORS configuration
            s3_client.delete_bucket_cors(Bucket=bucket_name)
        else:
            # Create or update CORS configuration
            s3_client.put_bucket_cors(
                Bucket=bucket_name,
                CORSConfiguration=cors_configuration
            )
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
    except Exception as e:
        print(f"Error: {str(e)}")
        cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': str(e)})
      `),
      timeout: cdk.Duration.seconds(30),
    });

    // Grant permissions to modify bucket CORS
    corsLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:PutBucketCORS',
        's3:GetBucketCORS',
        's3:DeleteBucketCORS',
      ],
      resources: [bucket.bucketArn],
    }));

    // Custom resource provider
    const provider = new customResources.Provider(this, 'S3CorsConfigProvider', {
      onEventHandler: corsLambda,
    });

    // Custom resource to trigger the Lambda
    new cdk.CustomResource(this, 'S3CorsConfigResource', {
      serviceToken: provider.serviceToken,
      properties: {
        BucketName: bucket.bucketName,
      },
    });
  }
}
