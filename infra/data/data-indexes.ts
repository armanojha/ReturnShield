/**
 * Phase 02 (task P2-DB-01) access-pattern indexes and least-privilege grant
 * helper for the shared Phase 01 `CoreTable`.
 *
 * STATUS: authored, NOT wired into `infra/lib/returnshield-stack.ts` and NOT
 * synthesized or deployed. Per the Phase 02 task instructions this task
 * avoids editing the central stack file directly (that file is owned by
 * P1-INF-01 / the integrator). See `README.md#integration-patch` for the
 * exact two-line patch a terminal-enabled integrator applies to wire this
 * in, plus the `cdk diff`/`cdk synth` commands to verify it.
 */
import type { aws_dynamodb as dynamodb, aws_iam as iam } from 'aws-cdk-lib';
import { aws_dynamodb as ddb, aws_iam as iamLib } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import { GSI, GSI_ATTR } from './table-schema';

export interface ReturnShieldDataIndexesProps {
  /** The existing Phase 01 `CoreTable` (`ReturnShieldStack.table`). */
  table: dynamodb.Table;
  /** DynamoDB permits only one GSI create/delete per table update. */
  count?: number;
}

/**
 * Adds the four Phase 02 global secondary indexes to the existing table.
 *
 * This is a plain helper class, not a CDK `Construct` subclass, because it
 * only calls `Table.addGlobalSecondaryIndex` on an existing construct and
 * defines no resources of its own — there is nothing for a construct id to
 * scope. The `scope`/`id` parameters are accepted anyway so the call site in
 * the integration patch reads like every other construct instantiation in
 * this codebase, and so a future version that *does* add its own resources
 * (e.g. a dedicated seed IAM user) can do so without changing call sites.
 */
export class ReturnShieldDataIndexes {
  constructor(_scope: Construct, _id: string, props: ReturnShieldDataIndexesProps) {
    const { table, count = 4 } = props;
    const definitions = [
      [GSI.BY_SELLER, GSI_ATTR.BY_SELLER],
      [GSI.BY_CUSTOMER, GSI_ATTR.BY_CUSTOMER],
      [GSI.BY_ORDER, GSI_ATTR.BY_ORDER],
      [GSI.CASE_QUEUE, GSI_ATTR.CASE_QUEUE],
    ] as const;
    for (const [indexName, attributes] of definitions.slice(0, Math.max(0, Math.min(4, count)))) {
      table.addGlobalSecondaryIndex({
        indexName,
        partitionKey: { name: attributes.pk, type: ddb.AttributeType.STRING },
        sortKey: { name: attributes.sk, type: ddb.AttributeType.STRING },
        projectionType: ddb.ProjectionType.ALL,
      });
    }
  }
}

/**
 * Least-privilege DynamoDB grant for a Phase 03+ Lambda that needs to read
 * or write ReturnShield data through `@returnshield/data` repositories.
 *
 * Deliberately excludes `dynamodb:DeleteTable`, `dynamodb:UpdateTable`,
 * `dynamodb:Scan` and `dynamodb:UpdateTimeToLive` — no production runtime
 * path needs them. `TransactWriteItems`/`TransactGetItems` are included
 * because `ReturnCaseRepository` commits the case update and its RiskEvent
 * items atomically. Not called from Phase 01/02 (the health function has no
 * data access, and Phase 02 authors no Lambda); provided for the Phase 03+
 * integrator to attach to whichever role calls the repositories at runtime.
 */
export function grantReturnShieldDataAccess(
  table: dynamodb.Table,
  grantee: iam.IGrantable,
): iam.Grant {
  return iamLib.Grant.addToPrincipal({
    grantee,
    actions: [
      'dynamodb:GetItem',
      'dynamodb:BatchGetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:Query',
      'dynamodb:ConditionCheckItem',
      'dynamodb:TransactWriteItems',
      'dynamodb:TransactGetItems',
    ],
    resourceArns: [table.tableArn, `${table.tableArn}/index/*`],
  });
}
