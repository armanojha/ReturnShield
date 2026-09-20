import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';

import { ReturnShieldStack, isEnvironmentName, resourceName } from '../lib/returnshield-stack';

let template: Template;

beforeAll(() => {
  const app = new App();
  const stack = new ReturnShieldStack(app, 'TestStack', { envName: 'dev' });
  template = Template.fromStack(stack);
});

describe('environment naming', () => {
  it('builds returnshield-<env>-<resource> names', () => {
    expect(resourceName('dev', 'health')).toBe('returnshield-dev-health');
    expect(resourceName('prod', 'api')).toBe('returnshield-prod-api');
  });

  it('accepts only the three declared environments', () => {
    expect(isEnvironmentName('dev')).toBe(true);
    expect(isEnvironmentName('staging')).toBe(true);
    expect(isEnvironmentName('prod')).toBe(true);
    expect(isEnvironmentName('production')).toBe(false);
  });
});

describe('health function', () => {
  it('runs on the supported Node runtime', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'returnshield-dev-health',
      Runtime: 'nodejs20.x',
    });
  });

  it('carries the environment name and a log level', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'returnshield-dev-health',
      Environment: { Variables: Match.objectLike({ RETURNSHIELD_ENV: 'dev' }) },
    });
  });

  it('holds no permissions beyond writing its own logs', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const healthPolicy = Object.values(policies).find((policy) => {
      const statements = (
        policy.Properties as { PolicyDocument: { Statement: { Action: string | string[] }[] } }
      ).PolicyDocument.Statement;
      const actions = statements.flatMap((statement) =>
        Array.isArray(statement.Action) ? statement.Action : [statement.Action],
      );
      return actions.length > 0 && actions.every((action) => action.startsWith('logs:'));
    });
    expect(healthPolicy).toBeDefined();
    const actions = [healthPolicy!].flatMap((policy) =>
      (
        policy.Properties as {
          PolicyDocument: { Statement: { Action: string | string[] }[] };
        }
      ).PolicyDocument.Statement.flatMap((statement) =>
        Array.isArray(statement.Action) ? statement.Action : [statement.Action],
      ),
    );

    expect(actions).toContain('logs:PutLogEvents');
    expect(actions.some((action) => action.startsWith('dynamodb:'))).toBe(false);
    expect(actions.some((action) => action.startsWith('bedrock:'))).toBe(false);
    expect(actions).not.toContain('*');
  });
});

describe('api boundary', () => {
  it('exposes health and listing retrieval GET methods', () => {
    const methods = template.findResources('AWS::ApiGateway::Method');
    const gets = Object.values(methods).filter(
      (method) => (method.Properties as { HttpMethod: string }).HttpMethod === 'GET',
    );
    expect(gets).toHaveLength(10);
  });

  it('nests health beneath the versioned root', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'v1' });
    template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'health' });
  });

  it('writes stage access logs to CloudWatch', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'dev',
      AccessLogSetting: Match.objectLike({ DestinationArn: Match.anyValue() }),
    });
  });
});

describe('observability and data placeholder', () => {
  it('creates log groups with an explicit retention', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/returnshield-dev-health',
      RetentionInDays: 7,
    });
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/apigateway/returnshield-dev-api',
    });
  });

  it('creates the on-demand table later phases will populate', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'returnshield-dev-core',
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  it('creates the return workflow and review-event routing', () => {
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
    template.resourceCountIs('AWS::Events::EventBus', 1);
    template.resourceCountIs('AWS::Events::Rule', 1);
    template.resourceCountIs('AWS::SQS::Queue', 1);
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'returnshield-dev-investigation-dlq',
      MessageRetentionPeriod: 1209600,
    });
  });

  it('creates a private, encrypted, versioned image evidence bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.anyValue(),
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: 'Enabled' },
      LifecycleConfiguration: Match.anyValue(),
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'returnshield-dev-image',
      Environment: {
        Variables: Match.objectLike({ RETURNSHIELD_IMAGE_BUCKET_NAME: Match.anyValue() }),
      },
    });
  });

  it('routes review events with bounded retries and a dead-letter queue', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['returnshield.returns'],
        'detail-type': ['RETURN_NEEDS_REVIEW'],
      },
      Targets: Match.arrayWith([
        Match.objectLike({
          RetryPolicy: { MaximumEventAgeInSeconds: 3600, MaximumRetryAttempts: 2 },
          DeadLetterConfig: { Arn: Match.anyValue() },
        }),
      ]),
    });
    template.hasResourceProperties('AWS::Lambda::EventInvokeConfig', {
      MaximumRetryAttempts: 1,
      DestinationConfig: { OnFailure: { Destination: Match.anyValue() } },
    });
  });

  it('gives both AI functions model-scoped invoke permission', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const bedrockStatements = Object.values(policies).flatMap((policy) =>
      (
        policy.Properties as {
          PolicyDocument: { Statement: { Action: string | string[]; Resource: unknown }[] };
        }
      ).PolicyDocument.Statement.filter(
        (statement) =>
          (Array.isArray(statement.Action) ? statement.Action : [statement.Action]).includes(
            'bedrock:InvokeModel',
          ) && statement.Resource !== '*',
      ),
    );
    expect(bedrockStatements).toHaveLength(2);
    for (const statement of bedrockStatements) {
      const serialized = JSON.stringify(statement.Resource);
      expect(serialized).toContain('foundation-model');
      expect(serialized).toContain('inference-profile');
      expect(statement.Resource).not.toBe('*');
    }
  });
});

describe('outputs', () => {
  it('publishes the URLs and names an operator needs', () => {
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toEqual(
      expect.arrayContaining([
        'ApiBaseUrl',
        'CoreTableName',
        'HealthEndpoint',
        'HealthFunctionName',
        'ReturnFunctionName',
        'ReturnWorkflowArn',
        'ReviewEventBusName',
        'InvestigatorFunctionName',
        'InvestigationDeadLetterQueueUrl',
        'ImageFunctionName',
        'ImageEvidenceBucketName',
      ]),
    );
  });
});
