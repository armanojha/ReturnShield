import * as path from 'node:path';

import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  aws_apigateway as apigateway,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
} from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import { grantReturnShieldDataAccess, ReturnShieldDataIndexes } from '../data/data-indexes';

/** Environments this stack may be deployed into. */
export const ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

export function isEnvironmentName(value: string): value is EnvironmentName {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

/** `returnshield-<env>-<resource>` — the single naming rule for the project. */
export function resourceName(env: EnvironmentName, resource: string): string {
  return `returnshield-${env}-${resource}`;
}

export interface ReturnShieldStackProps extends StackProps {
  envName: EnvironmentName;
}

/**
 * Base stack for Phase 01 (task P1-INF-01).
 *
 * Scope is deliberately limited to the Tier 0 services the health path needs,
 * plus the DynamoDB table Phase 02 will populate. Step Functions, EventBridge,
 * Bedrock and the feature Lambdas belong to later phases and are intentionally
 * absent rather than stubbed.
 *
 * No account ID, deployed identifier or secret appears in this file: the
 * account and region come from the deploying CLI session.
 */
export class ReturnShieldStack extends Stack {
  public readonly api: apigateway.RestApi;
  public readonly table: dynamodb.Table;
  public readonly healthFunction: nodejs.NodejsFunction;
  public readonly listingFunction: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: ReturnShieldStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const isProduction = envName === 'prod';
    const retention = isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK;

    Tags.of(this).add('project', 'returnshield');
    Tags.of(this).add('environment', envName);
    Tags.of(this).add('data-classification', 'synthetic');

    // --- Data placeholder -------------------------------------------------
    // Single-table design, created here so later phases have a stable target.
    // Phase 01 writes nothing to it and grants no access to it.
    this.table = new dynamodb.Table(this, 'CoreTable', {
      tableName: resourceName(envName, 'core'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: isProduction,
      deletionProtection: isProduction,
      removalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const requestedGsiCount = Number(this.node.tryGetContext('gsiStage') ?? 4);
    const gsiCount = Number.isInteger(requestedGsiCount)
      ? Math.max(0, Math.min(4, requestedGsiCount))
      : 4;
    new ReturnShieldDataIndexes(this, 'DataIndexes', { table: this.table, count: gsiCount });

    // --- Health function --------------------------------------------------
    const healthLogGroup = new logs.LogGroup(this, 'HealthFunctionLogs', {
      logGroupName: `/aws/lambda/${resourceName(envName, 'health')}`,
      retention,
      removalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Least privilege: an empty role that receives only the CloudWatch Logs
    // actions for its own log group. The AWS managed basic-execution policy is
    // deliberately not attached, and no table or Bedrock access is granted.
    const healthRole = new iam.Role(this, 'HealthFunctionRole', {
      roleName: resourceName(envName, 'health-role'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Least-privilege execution role for the ReturnShield health function.',
    });

    healthRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [healthLogGroup.logGroupArn, `${healthLogGroup.logGroupArn}:*`],
      }),
    );

    this.healthFunction = new nodejs.NodejsFunction(this, 'HealthFunction', {
      functionName: resourceName(envName, 'health'),
      description: 'GET /v1/health — returns the frozen Phase 00 health envelope.',
      entry: path.join(__dirname, '..', '..', 'services', 'health', 'src', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      role: healthRole,
      logGroup: healthLogGroup,
      environment: {
        LOG_LEVEL: isProduction ? 'info' : 'debug',
        RETURNSHIELD_ENV: envName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: nodejs.OutputFormat.ESM,
        // Ajv compiles validators at runtime; keep it in the bundle.
        externalModules: ['@aws-sdk/*'],
      },
    });

    // --- ListingGuard function ------------------------------------------
    const listingLogGroup = new logs.LogGroup(this, 'ListingFunctionLogs', {
      logGroupName: `/aws/lambda/${resourceName(envName, 'listing')}`,
      retention,
      removalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    const listingRole = new iam.Role(this, 'ListingFunctionRole', {
      roleName: resourceName(envName, 'listing-role'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Least-privilege execution role for ListingGuard.',
    });
    listingRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [listingLogGroup.logGroupArn, `${listingLogGroup.logGroupArn}:*`],
      }),
    );
    grantReturnShieldDataAccess(this.table, listingRole);
    listingRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['bedrock:Converse'], resources: ['*'] }),
    );
    this.listingFunction = new nodejs.NodejsFunction(this, 'ListingFunction', {
      functionName: resourceName(envName, 'listing'),
      description: 'POST /v1/listings/analyze and GET /v1/listings/{listing_id}.',
      entry: path.join(__dirname, '..', '..', 'services', 'listing', 'src', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(15),
      role: listingRole,
      logGroup: listingLogGroup,
      environment: {
        LOG_LEVEL: isProduction ? 'info' : 'debug',
        RETURNSHIELD_ENV: envName,
        RETURNSHIELD_TABLE_NAME: this.table.tableName,
        BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? 'amazon.nova-lite-v1:0',
        BEDROCK_TIMEOUT_MS: '8000',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: nodejs.OutputFormat.ESM,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // --- HTTP boundary ----------------------------------------------------
    const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/${resourceName(envName, 'api')}`,
      retention,
      removalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: resourceName(envName, 'api'),
      description: 'ReturnShield v1 API (synthetic demonstration deployment).',
      cloudWatchRole: true,
      deployOptions: {
        stageName: envName,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: false,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: false,
        }),
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        metricsEnabled: true,
        throttlingBurstLimit: 50,
        throttlingRateLimit: 25,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['content-type', 'x-correlation-id', 'idempotency-key'],
      },
    });

    // Later phases add /listings, /returns, /cases, /sellers and /dashboard
    // beneath this same versioned root.
    const v1 = this.api.root.addResource('v1');
    v1.addResource('health').addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.healthFunction, { proxy: true }),
    );
    const listings = v1.addResource('listings');
    listings
      .addResource('analyze')
      .addMethod('POST', new apigateway.LambdaIntegration(this.listingFunction, { proxy: true }));
    listings
      .addResource('{listing_id}')
      .addMethod('GET', new apigateway.LambdaIntegration(this.listingFunction, { proxy: true }));

    // --- Outputs ----------------------------------------------------------
    new CfnOutput(this, 'ApiBaseUrl', {
      value: this.api.url,
      description: 'Base URL of the deployed stage. Set as VITE_API_BASE_URL for the web app.',
    });

    new CfnOutput(this, 'HealthEndpoint', {
      value: `${this.api.url}v1/health`,
      description: 'Fully qualified health endpoint, for the smoke check.',
    });

    new CfnOutput(this, 'CoreTableName', {
      value: this.table.tableName,
      description: 'DynamoDB table reserved for Phase 02 data access.',
    });

    new CfnOutput(this, 'HealthFunctionName', {
      value: this.healthFunction.functionName,
      description: 'Health Lambda function name, for log lookup.',
    });

    new CfnOutput(this, 'ListingFunctionName', {
      value: this.listingFunction.functionName,
      description: 'ListingGuard Lambda function name, for log lookup.',
    });
  }
}
