import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createRepositories, DynamoDbRepositoryStore } from '@returnshield/data';

import { processWorkflowAction } from './processor.js';
import type { WorkerEvent } from './types.js';

const tableName = process.env.RETURNSHIELD_TABLE_NAME ?? '';
const repositories = tableName
  ? createRepositories(
      new DynamoDbRepositoryStore(tableName, DynamoDBDocumentClient.from(new DynamoDBClient({}))),
    )
  : undefined;

export async function handler(event: WorkerEvent) {
  if (!repositories) throw new Error('Workflow worker is not configured');
  return processWorkflowAction(event, repositories);
}

export default handler;
