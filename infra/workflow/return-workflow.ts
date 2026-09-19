import * as path from 'node:path';

import {
  Duration,
  RemovalPolicy,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
} from 'aws-cdk-lib';
import type { aws_dynamodb as dynamodb, aws_events as events } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { grantReturnShieldDataAccess } from '../data/data-indexes';

export interface ReturnWorkflowProps {
  envName: string;
  table: dynamodb.Table;
  retention: logs.RetentionDays;
  isProduction: boolean;
  eventBus: events.IEventBus;
}

export class ReturnWorkflow extends Construct {
  public readonly worker: nodejs.NodejsFunction;
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: ReturnWorkflowProps) {
    super(scope, id);
    const name = (suffix: string) => `returnshield-${props.envName}-${suffix}`;
    const removalPolicy = props.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const workerLogs = new logs.LogGroup(this, 'WorkerLogs', {
      logGroupName: `/aws/lambda/${name('return-workflow')}`,
      retention: props.retention,
      removalPolicy,
    });
    const workerRole = new iam.Role(this, 'WorkerRole', {
      roleName: name('return-workflow-role'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    workerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [workerLogs.logGroupArn, `${workerLogs.logGroupArn}:*`],
      }),
    );
    grantReturnShieldDataAccess(props.table, workerRole);
    props.eventBus.grantPutEventsTo(workerRole);
    this.worker = new nodejs.NodejsFunction(this, 'Worker', {
      functionName: name('return-workflow'),
      entry: path.join(__dirname, '..', '..', 'services', 'workflow', 'src', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(20),
      role: workerRole,
      logGroup: workerLogs,
      environment: {
        RETURNSHIELD_TABLE_NAME: props.table.tableName,
        RETURNSHIELD_EVENT_BUS_NAME: props.eventBus.eventBusName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: nodejs.OutputFormat.ESM,
        externalModules: ['@aws-sdk/*'],
      },
    });

    const actions = [
      'ValidateReturn',
      'FetchHistory',
      'CalculateSignals',
      'CalculateRisk',
      'Decision',
      'CreateOrUpdateCase',
      'NeedsReviewEvent',
      'InvestigationExplanation',
      'SurfaceToReviewer',
    ] as const;
    const states = actions.map(
      (action) =>
        new tasks.LambdaInvoke(this, action, {
          stateName: action,
          lambdaFunction: this.worker,
          payloadResponseOnly: true,
          payload: sfn.TaskInput.fromObject({ action, 'state.$': '$' }),
          taskTimeout: sfn.Timeout.duration(Duration.seconds(20)),
        }),
    );
    for (const index of [1, 3, 5])
      states[index]!.addRetry({
        errors: [
          'Lambda.ServiceException',
          'Lambda.AWSLambdaException',
          'Lambda.SdkClientException',
        ],
        interval: Duration.seconds(1),
        backoffRate: 2,
        maxAttempts: 3,
      });
    states[6]!.addRetry({
      errors: ['States.TaskFailed'],
      interval: Duration.seconds(1),
      backoffRate: 2,
      maxAttempts: 3,
    });
    for (let index = 0; index < states.length - 1; index += 1)
      states[index]!.next(states[index + 1]!);
    const workflowLogs = new logs.LogGroup(this, 'StateMachineLogs', {
      logGroupName: `/aws/vendedlogs/states/${name('returns')}`,
      retention: props.retention,
      removalPolicy,
    });
    this.stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: name('returns'),
      definitionBody: sfn.DefinitionBody.fromChainable(states[0]!),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: Duration.minutes(2),
      logs: { destination: workflowLogs, level: sfn.LogLevel.ALL, includeExecutionData: true },
      tracingEnabled: false,
    });
  }
}
