import * as path from 'node:path';

import {
  Arn,
  ArnFormat,
  Duration,
  RemovalPolicy,
  Stack,
  aws_apigateway as apigateway,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import type { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { grantReturnShieldDataAccess } from '../data/data-indexes';

export interface ImageEvidenceProps {
  envName: string;
  table: dynamodb.Table;
  v1: apigateway.IResource;
  retention: logs.RetentionDays;
  isProduction: boolean;
  bedrockModelId: string;
}

export class ImageEvidenceInfrastructure extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly imageFunction: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: ImageEvidenceProps) {
    super(scope, id);
    const name = (suffix: string) => `returnshield-${props.envName}-${suffix}`;
    const removalPolicy = props.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      removalPolicy,
      lifecycleRules: [
        { expiration: Duration.days(7), noncurrentVersionExpiration: Duration.days(7) },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['content-type'],
        },
      ],
    });
    const functionName = name('image');
    const logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: props.retention,
      removalPolicy,
    });
    const role = new iam.Role(this, 'Role', {
      roleName: name('image-role'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
      }),
    );
    grantReturnShieldDataAccess(props.table, role);
    this.bucket.grantReadWrite(role);
    const stack = Stack.of(this);
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          Arn.format(
            {
              service: 'bedrock',
              region: stack.region,
              account: '',
              resource: 'foundation-model',
              resourceName: props.bedrockModelId,
              arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            },
            stack,
          ),
          Arn.format(
            {
              service: 'bedrock',
              region: stack.region,
              account: stack.account,
              resource: 'inference-profile',
              resourceName: props.bedrockModelId,
              arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            },
            stack,
          ),
        ],
      }),
    );
    this.imageFunction = new nodejs.NodejsFunction(this, 'Function', {
      functionName,
      entry: path.join(__dirname, '..', '..', 'services', 'image', 'src', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      role,
      logGroup,
      environment: {
        RETURNSHIELD_TABLE_NAME: props.table.tableName,
        RETURNSHIELD_IMAGE_BUCKET_NAME: this.bucket.bucketName,
        BEDROCK_MODEL_ID: props.bedrockModelId,
        IMAGE_ANALYSIS_TIMEOUT_MS: '15000',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: nodejs.OutputFormat.ESM,
        externalModules: ['@aws-sdk/*'],
      },
    });
    const integration = new apigateway.LambdaIntegration(this.imageFunction, { proxy: true });
    const images = props.v1.addResource('images');
    images.addResource('uploads').addMethod('POST', integration);
    const image = images.addResource('{image_id}');
    image.addMethod('GET', integration);
    image.addResource('complete').addMethod('POST', integration);
    image.addResource('download').addMethod('GET', integration);
    props.v1
      .getResource('listings')!
      .getResource('{listing_id}')!
      .addResource('images')
      .addMethod('GET', integration);
    const caseRoot = props.v1.getResource('cases') ?? props.v1.addResource('cases');
    (caseRoot.getResource('{case_id}') ?? caseRoot.addResource('{case_id}'))
      .addResource('images')
      .addMethod('GET', integration);
  }
}
