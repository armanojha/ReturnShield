/**
 * AUTHORED, NOT VERIFIED (Phase 02, task P2-DB-01).
 *
 * Not yet wired into `infra/vitest.config.ts`'s `include` glob (which only
 * covers `infra/test/**`, to keep this task inside its owned
 * `infra/data/**` path — see the Phase 02 handoff for the exact one-line
 * config patch). Until then, run directly:
 *
 *   npx vitest run infra/data/test/data-indexes.test.ts --root infra
 */
import { App, Stack, aws_dynamodb as dynamodb, aws_iam as iam } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';

import { grantReturnShieldDataAccess, ReturnShieldDataIndexes } from '../data-indexes';
import { GSI, GSI_ATTR, TABLE_PRIMARY_KEY, TABLE_SORT_KEY } from '../table-schema';

function buildTemplate(): { template: Template } {
  const app = new App();
  const stack = new Stack(app, 'TestDataIndexesStack');

  const table = new dynamodb.Table(stack, 'CoreTable', {
    tableName: 'returnshield-dev-core',
    partitionKey: { name: TABLE_PRIMARY_KEY, type: dynamodb.AttributeType.STRING },
    sortKey: { name: TABLE_SORT_KEY, type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  });

  new ReturnShieldDataIndexes(stack, 'DataIndexes', { table });

  const role = new iam.Role(stack, 'ConsumerRole', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  });
  grantReturnShieldDataAccess(table, role);

  return { template: Template.fromStack(stack) };
}

describe('ReturnShieldDataIndexes', () => {
  it('adds exactly the four Phase 02 access-pattern GSIs', () => {
    const { template } = buildTemplate();

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: GSI.BY_SELLER,
          KeySchema: [
            { AttributeName: GSI_ATTR.BY_SELLER.pk, KeyType: 'HASH' },
            { AttributeName: GSI_ATTR.BY_SELLER.sk, KeyType: 'RANGE' },
          ],
        }),
        Match.objectLike({
          IndexName: GSI.BY_CUSTOMER,
          KeySchema: [
            { AttributeName: GSI_ATTR.BY_CUSTOMER.pk, KeyType: 'HASH' },
            { AttributeName: GSI_ATTR.BY_CUSTOMER.sk, KeyType: 'RANGE' },
          ],
        }),
        Match.objectLike({
          IndexName: GSI.BY_ORDER,
          KeySchema: [
            { AttributeName: GSI_ATTR.BY_ORDER.pk, KeyType: 'HASH' },
            { AttributeName: GSI_ATTR.BY_ORDER.sk, KeyType: 'RANGE' },
          ],
        }),
        Match.objectLike({
          IndexName: GSI.CASE_QUEUE,
          KeySchema: [
            { AttributeName: GSI_ATTR.CASE_QUEUE.pk, KeyType: 'HASH' },
            { AttributeName: GSI_ATTR.CASE_QUEUE.sk, KeyType: 'RANGE' },
          ],
        }),
      ]),
    });

    const tables = template.findResources('AWS::DynamoDB::Table');
    const [tableResource] = Object.values(tables);
    const gsis = (tableResource.Properties as { GlobalSecondaryIndexes: unknown[] })
      .GlobalSecondaryIndexes;
    expect(gsis).toHaveLength(4);
  });

  it('grants only the documented least-privilege DynamoDB actions', () => {
    const { template } = buildTemplate();
    const policies = template.findResources('AWS::IAM::Policy');
    const actions = Object.values(policies).flatMap((policy) =>
      (
        policy.Properties as { PolicyDocument: { Statement: { Action: string | string[] }[] } }
      ).PolicyDocument.Statement.flatMap((statement) =>
        Array.isArray(statement.Action) ? statement.Action : [statement.Action],
      ),
    );

    for (const expected of [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:Query',
      'dynamodb:TransactWriteItems',
    ]) {
      expect(actions).toContain(expected);
    }
    expect(actions).not.toContain('dynamodb:DeleteTable');
    expect(actions).not.toContain('dynamodb:Scan');
    expect(actions).not.toContain('*');
  });
});
