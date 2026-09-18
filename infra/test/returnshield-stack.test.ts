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
    const actions = Object.values(policies).flatMap((policy) =>
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
  it('exposes exactly one GET method in Phase 01', () => {
    const methods = template.findResources('AWS::ApiGateway::Method');
    const gets = Object.values(methods).filter(
      (method) => (method.Properties as { HttpMethod: string }).HttpMethod === 'GET',
    );
    expect(gets).toHaveLength(1);
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

  it('does not create later-phase services', () => {
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 0);
    template.resourceCountIs('AWS::Events::Rule', 0);
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
      ]),
    );
  });
});
