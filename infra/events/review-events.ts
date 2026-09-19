import * as path from 'node:path';

import {
  Arn,
  ArnFormat,
  Duration,
  RemovalPolicy,
  Stack,
  aws_events as events,
  aws_events_targets as targets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_destinations as destinations,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_sqs as sqs,
} from 'aws-cdk-lib';
import type { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { grantReturnShieldDataAccess } from '../data/data-indexes';

export interface ReviewEventsProps {
  envName: string;
  table: dynamodb.Table;
  retention: logs.RetentionDays;
  isProduction: boolean;
  bedrockModelId: string;
}

export class ReviewEvents extends Construct {
  public readonly eventBus: events.EventBus;
  public readonly investigator: nodejs.NodejsFunction;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: ReviewEventsProps) {
    super(scope, id);
    const name = (suffix: string) => `returnshield-${props.envName}-${suffix}`;
    const removalPolicy = props.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    this.eventBus = new events.EventBus(this, 'Bus', {
      eventBusName: name('events'),
    });
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: name('investigation-dlq'),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
      removalPolicy,
    });

    const functionName = name('investigator');
    const logGroup = new logs.LogGroup(this, 'InvestigatorLogs', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: props.retention,
      removalPolicy,
    });
    const role = new iam.Role(this, 'InvestigatorRole', {
      roleName: name('investigator-role'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
      }),
    );
    grantReturnShieldDataAccess(props.table, role);
    const stack = Stack.of(this);
    const foundationModelArn = Arn.format(
      {
        service: 'bedrock',
        region: stack.region,
        account: '',
        resource: 'foundation-model',
        resourceName: props.bedrockModelId,
        arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
      },
      stack,
    );
    const inferenceProfileArn = Arn.format(
      {
        service: 'bedrock',
        region: stack.region,
        account: stack.account,
        resource: 'inference-profile',
        resourceName: props.bedrockModelId,
        arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
      },
      stack,
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [foundationModelArn, inferenceProfileArn],
      }),
    );

    this.investigator = new nodejs.NodejsFunction(this, 'Investigator', {
      functionName,
      entry: path.join(__dirname, '..', '..', 'services', 'investigation', 'src', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(40),
      retryAttempts: 1,
      onFailure: new destinations.SqsDestination(this.deadLetterQueue),
      role,
      logGroup,
      environment: {
        RETURNSHIELD_TABLE_NAME: props.table.tableName,
        BEDROCK_MODEL_ID: props.bedrockModelId,
        INVESTIGATOR_TIMEOUT_MS: '20000',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: nodejs.OutputFormat.ESM,
        externalModules: ['@aws-sdk/*'],
      },
    });

    new events.Rule(this, 'NeedsReviewRule', {
      ruleName: name('needs-review'),
      eventBus: this.eventBus,
      eventPattern: {
        source: ['returnshield.returns'],
        detailType: ['RETURN_NEEDS_REVIEW'],
      },
      targets: [
        new targets.LambdaFunction(this.investigator, {
          deadLetterQueue: this.deadLetterQueue,
          retryAttempts: 2,
          maxEventAge: Duration.hours(1),
        }),
      ],
    });
  }
}
