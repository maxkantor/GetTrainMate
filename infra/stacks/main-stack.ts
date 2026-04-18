import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as appsync from 'aws-cdk-lib/aws-appsync';
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
    let userPoolClientIdOutput: string | undefined;
    if (userPoolId) {
      userPool = cognito.UserPool.fromUserPoolId(this, 'UserPool', userPoolId);
      userPoolClientIdOutput = userPoolClientId || undefined;
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

      // Create User Pool Client and capture for output
      const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
        userPool,
        userPoolClientName: 'gettrainmate-web-client',
        generateSecret: false,
        authFlows: {
          userPassword: true,
          userSrp: true,
        },
      });
      userPoolClientIdOutput = userPoolClient.userPoolClientId;
    }

    // Optional second pools — **cdk.json context only** (do not read process.env here: a stray shell var at synth
    // time used to bake wrong AMPLIFY_USER_POOL_ID into Lambda and break Admin CRM).
    const primaryPoolId = userPool.userPoolId;
    const cognitoExtraPoolIds = String((this.node.tryGetContext('cognitoExtraUserPoolIds') as string | undefined) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((id) => id !== primaryPoolId);
    const amplifyRaw = String((this.node.tryGetContext('amplifyUserPoolId') as string | undefined) ?? '').trim();
    const amplifyUserPoolId =
      amplifyRaw.length > 0 && amplifyRaw !== primaryPoolId ? amplifyRaw : '';
    const allExtraPoolIds = Array.from(
      new Set([...cognitoExtraPoolIds, amplifyUserPoolId].filter((id) => id.length > 0))
    );
    // Allow AdminGetUser/ListUsers/GetUser for any user pool in this account. Scoped ARNs from synth
    // alone caused AccessDenied after runtime pool-id fixes (typo I→l, SSM) until IAM was redeployed.
    const cognitoIdpUserPoolsInAccount = `arn:aws:cognito-idp:*:${this.account}:userpool/*`;

    // DynamoDB Tables
    const tables = this.createDynamoDBTables();
    const adminTables = this.createAdminAndCRMTables();
    const contactsTables = this.createContactsTables();
    const tokenWalletTables = this.createTokenWalletTables();
    const creditsTables = this.createCreditsTables();
    const allTables = [...tables, ...adminTables, ...contactsTables, ...tokenWalletTables, ...creditsTables];

    // S3 Bucket for media storage (existing bucket). CORS must allow the web origin for browser PUT uploads:
    //   aws s3api put-bucket-cors --bucket gettrainmate-media-bucket --cors-configuration file://infra/s3-media-bucket-cors.json
    // Admin test-user uploads use Lambda→S3 (no browser PUT); do not duplicate CORS in the Lambda app (see Startup.cs).
    // Physical bucket name must match S3 console exactly (typo → Lambda NoSuchBucket on every GetObject).
    // Override: npx cdk deploy --context mediaBucketName=your-real-bucket-name
    const mediaBucketName =
      (this.node.tryGetContext('mediaBucketName') as string | undefined) || 'gettrainmate-media-bucket';
    const mediaBucket = s3.Bucket.fromBucketName(this, 'MediaBucket', mediaBucketName);
    // Runtime code tries this name if primary env/CDK name was wrong (same length typo).
    const mediaBucketTypoFallback = s3.Bucket.fromBucketName(this, 'MediaBucketTypoFallback', 'gettraindmat-media-bucket');

    // Bedrock model for AI features (match insight, chat, icebreakers). Override: --context bedrockModelId=...
    // Use inference profile ID (us. prefix) - direct model ID on-demand is no longer supported by Bedrock
    const bedrockModelId = this.node.tryGetContext('bedrockModelId') || 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

    // Lambda function for API
    // Note: The Lambda code needs to be built and published first:
    // cd apps/api && dotnet publish -c Release
    const apiLambda = new lambda.Function(this, 'ApiFunction', {
      runtime: new lambda.Runtime('dotnet8', lambda.RuntimeFamily.DOTNET_CORE),
      handler: 'GetTrainMate.Api::GetTrainMate.Api.LambdaEntryPoint::FunctionHandlerAsync',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/api/publish')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ASPNETCORE_ENVIRONMENT: 'Production',
        // AWS_REGION is automatically set by Lambda runtime
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_EXTRA_USER_POOL_IDS: allExtraPoolIds.join(','),
        AMPLIFY_USER_POOL_ID: amplifyUserPoolId,
        DYNAMODB_TABLE_PREFIX: 'gettrainmate-',
        DYNAMODB_TABLE_AUDIT_LOG: 'gettrainmate-audit-log',
        MEDIA_BUCKET_NAME: mediaBucket.bucketName,
        // Must match physical bucket region (GetObject returns NoSuchBucket if client region is wrong).
        MEDIA_BUCKET_REGION:
          (this.node.tryGetContext('mediaBucketRegion') as string | undefined) || 'us-east-1',
        // Required for Stripe checkout redirect URLs. Set: npx cdk deploy --context frontendUrl=https://yourdomain.com
        FRONTEND_URL: this.node.tryGetContext('frontendUrl') || process.env.FRONTEND_URL || '',
        // Bedrock: ASP.NET maps Bedrock__ModelId -> Bedrock:ModelId; BEDROCK_MODEL_ID fallback
        Bedrock__ModelId: bedrockModelId,
        BEDROCK_MODEL_ID: bedrockModelId,
        Bedrock__Region: this.region,
        // Verified SES identity for outbound mail (chat notifications, etc.). Optional: omit until SES is set up.
        SES_FROM_EMAIL:
          this.node.tryGetContext('sesFromEmail') ||
          process.env.SES_FROM_EMAIL ||
          '',
      },
    });

    // Grant Lambda permissions
    allTables.forEach(table => {
      table.grantReadWriteData(apiLambda);
    });
    // Explicit DescribeTable (required by low-level DynamoDB Table.LoadTable)
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:DescribeTable', 'dynamodb:DescribeTimeToLive'],
      resources: [`arn:aws:dynamodb:${this.region}:${this.account}:table/gettrainmate-*`],
    }));
    mediaBucket.grantReadWrite(apiLambda);
    mediaBucketTypoFallback.grantReadWrite(apiLambda);
    // Resolve real bucket region when GetObject returns NoSuchBucket (wrong default endpoint / config).
    apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetBucketLocation'],
        resources: [mediaBucket.bucketArn, mediaBucketTypoFallback.bucketArn],
      }),
    );

    // Grant Lambda access to Cognito (GetUser for token validation, Admin* for admin features)
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:GetUser',
        'cognito-idp:AdminGetUser',
        // Admin CRM resolves email via ListUsers when Username != sub (email sign-in / aliases)
        'cognito-idp:ListUsers',
        'cognito-idp:AdminListGroupsForUser',
      ],
      resources: [cognitoIdpUserPoolsInAccount],
    }));
    // Cold-start diagnostics: list/describe pools when configured pool id is wrong (account/typo)
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cognito-idp:ListUserPools'],
      resources: ['*'],
    }));
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cognito-idp:DescribeUserPool'],
      // Pool region comes from pool id prefix (may differ from stack region if ever cross-region)
      resources: [`arn:aws:cognito-idp:*:${this.account}:userpool/*`],
    }));
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:GetCallerIdentity'],
      resources: ['*'],
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

    // Bedrock: use AWS managed policy (includes InvokeModel + Marketplace ViewSubscriptions/Subscribe)
    // Inline policies kept failing; managed policy is the authoritative fix.
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        'arn:aws:bedrock:*:*:inference-profile/*',
      ],
    }));
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aws-marketplace:ViewSubscriptions',
        'aws-marketplace:Subscribe',
        'aws-marketplace:Unsubscribe',
      ],
      resources: ['*'],
    }));
    // Attach AWS managed policies: Bedrock Marketplace + general Marketplace (ViewSubscriptions, Subscribe)
    apiLambda.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockMarketplaceAccess'));
    apiLambda.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSMarketplaceManageSubscriptions'));

    // Grant Lambda access to SSM Parameter Store (admin portal password at /gettrainmate/admin/password)
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:PutParameter',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/gettrainmate/*`,
      ],
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
          'X-Admin-Token',
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

    // ----- AppSync GraphQL API (chat, discover, matches, credits) -----
    const schemaPath = path.join(__dirname, '../appsync/schema.graphql');
    const graphqlApi = new appsync.GraphqlApi(this, 'GraphqlApi', {
      name: 'gettrainmate-graphql',
      definition: appsync.Definition.fromFile(schemaPath),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
          },
        },
        additionalAuthorizationModes: [],
      },
      xrayEnabled: false,
    });

    const resolverLambda = new nodejs.NodejsFunction(this, 'AppSyncResolver', {
      runtime: new lambda.Runtime('nodejs22.x', lambda.RuntimeFamily.NODEJS),
      handler: 'handler',
      entry: path.join(__dirname, '../lambdas/appsync-resolver/index.js'),
      timeout: cdk.Duration.seconds(25),
      memorySize: 256,
      environment: {
        DYNAMODB_TABLE_PREFIX: 'gettrainmate-',
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
        MEDIA_BUCKET_NAME: mediaBucket.bucketName,
        MEDIA_BUCKET_REGION:
          (this.node.tryGetContext('mediaBucketRegion') as string | undefined) || 'us-east-1',
      },
      bundling: {
        format: nodejs.OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        externalModules: [],
      },
    });
    allTables.forEach((table) => table.grantReadWriteData(resolverLambda));
    mediaBucket.grantRead(resolverLambda); // For presigned avatar URLs in getProfile
    resolverLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:AdminGetUser'],
        resources: [userPool.userPoolArn],
      }),
    );
    resolverLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }),
    );

    const lambdaDs = graphqlApi.addLambdaDataSource('ResolverDataSource', resolverLambda);

    // Explicit request template so Lambda always receives typeName, fieldName, arguments, identity.
    // Without this, AppSync may send a different payload and the resolver throws "Unknown field: undefined.undefined".
    // VTL: $ctx and $context are equivalent; use both so typeName/fieldName are always set
    const lambdaRequestTemplate = appsync.MappingTemplate.fromString(
      [
        '{',
        '  "version": "2018-05-29",',
        '  "operation": "Invoke",',
        '  "payload": {',
        '    "typeName": $util.toJson($context.info.parentTypeName),',
        '    "fieldName": $util.toJson($context.info.fieldName),',
        '    "arguments": $util.toJson($context.arguments),',
        '    "identity": $util.toJson($context.identity)',
        '  }',
        '}',
      ].join('\n')
    );
    const lambdaResponseTemplate = appsync.MappingTemplate.lambdaResult();

    const queryType = 'Query';
    const mutationType = 'Mutation';
    const subscriptionType = 'Subscription';
    [
      'getMe',
      'getProfile',
      'discoverCandidates',
      'listMyMatches',
      'listMySentRequests',
      'listMySkipped',
      'getThreadByMatch',
      'listMessages',
    ].forEach(
      (field) => {
        lambdaDs.createResolver(`${queryType}${field}`, {
          typeName: queryType,
          fieldName: field,
          requestMappingTemplate: lambdaRequestTemplate,
          responseMappingTemplate: lambdaResponseTemplate,
        });
      },
    );
    [
      'upsertProfile',
      'ensureFreeStartCredits',
      'likeUser',
      'passUser',
      'cancelSentInvite',
      'unlockChat',
      'createMessage',
      'seedDemoData',
    ].forEach((field) => {
      lambdaDs.createResolver(`${mutationType}${field}`, {
        typeName: mutationType,
        fieldName: field,
        requestMappingTemplate: lambdaRequestTemplate,
        responseMappingTemplate: lambdaResponseTemplate,
      });
    });
    lambdaDs.createResolver(`${subscriptionType}onMessageCreated`, {
      typeName: subscriptionType,
      fieldName: 'onMessageCreated',
      requestMappingTemplate: lambdaRequestTemplate,
      responseMappingTemplate: lambdaResponseTemplate,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url!,
      description: 'API Gateway URL',
      exportName: 'GetTrainMateApiUrl',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID - set as VITE_COGNITO_USER_POOL_ID in apps/web/.env',
      exportName: 'GetTrainMateUserPoolId',
    });

    if (userPoolClientIdOutput) {
      new cdk.CfnOutput(this, 'UserPoolClientId', {
        value: userPoolClientIdOutput,
        description: 'Cognito User Pool Client ID - set as VITE_COGNITO_CLIENT_ID in apps/web/.env',
        exportName: 'GetTrainMateUserPoolClientId',
      });
    }

    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: mediaBucket.bucketName,
      description: 'S3 Media Bucket Name',
      exportName: 'GetTrainMateMediaBucket',
    });

    new cdk.CfnOutput(this, 'GraphqlApiUrl', {
      value: graphqlApi.graphqlUrl,
      description: 'AppSync GraphQL API URL',
      exportName: 'GetTrainMateGraphqlApiUrl',
    });

    new cdk.CfnOutput(this, 'GraphqlApiId', {
      value: graphqlApi.apiId,
      description: 'AppSync API ID',
      exportName: 'GetTrainMateGraphqlApiId',
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

    // Discover: record Pass so those profiles are excluded from future discoverCandidates (REST + GraphQL)
    const discoverPassesTable = new dynamodb.Table(this, 'DiscoverPassesTable', {
      tableName: 'gettrainmate-discover-passes',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'targetUserId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(discoverPassesTable);

    // One row per (viewer, target): SKIPPED | SENT | MATCHED — single source of truth for Sent / Skipped / Match lists
    const userInteractionsTable = new dynamodb.Table(this, 'UserInteractionsTable', {
      tableName: 'gettrainmate-user-interactions',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'targetUserId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(userInteractionsTable);

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

    // Billing plans table - DB-driven, editable in Admin CRM (no Stripe price IDs in env)
    const billingPlansTable = new dynamodb.Table(this, 'BillingPlansTable', {
      tableName: 'gettrainmate-billing-plans',
      partitionKey: { name: 'Key', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(billingPlansTable);

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

    // App chat threads (match-based; threadId = matchId for match threads)
    const chatThreadsTable = new dynamodb.Table(this, 'ChatThreadsTable', {
      tableName: 'gettrainmate-chat-threads',
      partitionKey: { name: 'threadId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(chatThreadsTable);

    const userActivityTable = new dynamodb.Table(this, 'UserActivityTable', {
      tableName: 'gettrainmate-user-activity',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(userActivityTable);

    const chatNotificationStateTable = new dynamodb.Table(this, 'ChatNotificationStateTable', {
      tableName: 'gettrainmate-chat-notification-state',
      partitionKey: { name: 'stateKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(chatNotificationStateTable);

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

  private createCreditsTables(): dynamodb.ITable[] {
    const tables: dynamodb.ITable[] = [];

    // Credit pack config - DB-driven, editable in Admin CRM
    const creditPackConfigTable = new dynamodb.Table(this, 'CreditPackConfigTable', {
      tableName: 'gettrainmate-credit-pack-config',
      partitionKey: { name: 'Key', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(creditPackConfigTable);

    // User credits balance
    const userCreditsTable = new dynamodb.Table(this, 'UserCreditsTable', {
      tableName: 'gettrainmate-user-credits',
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(userCreditsTable);

    // Credit transactions (ledger)
    const creditTransactionsTable = new dynamodb.Table(this, 'CreditTransactionsTable', {
      tableName: 'gettrainmate-credit-transactions',
      partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    creditTransactionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'CreatedAt', type: dynamodb.AttributeType.STRING },
    });
    creditTransactionsTable.addGlobalSecondaryIndex({
      indexName: 'checkoutSessionId-index',
      partitionKey: { name: 'StripeCheckoutSessionId', type: dynamodb.AttributeType.STRING },
    });
    tables.push(creditTransactionsTable);

    // Stripe webhook events (idempotency)
    const stripeWebhookEventsTable = new dynamodb.Table(this, 'StripeWebhookEventsTable', {
      tableName: 'gettrainmate-stripe-webhook-events',
      partitionKey: { name: 'EventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.DEFAULT,
    });
    tables.push(stripeWebhookEventsTable);

    return tables;
  }
}
