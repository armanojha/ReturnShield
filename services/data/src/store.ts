import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

export type StoredItem = Record<string, unknown> & { pk: string; sk: string; entity_type: string };
export interface QueryInput {
  indexName?: string;
  partitionName?: string;
  partitionValue: string;
  beginsWith?: string;
}

export interface RepositoryStore {
  put(item: StoredItem, createOnly?: boolean): Promise<'WRITTEN' | 'CONFLICT'>;
  get(pk: string, sk: string): Promise<StoredItem | undefined>;
  query(input: QueryInput): Promise<StoredItem[]>;
  updateCase(item: StoredItem, expectedRevision: number): Promise<'WRITTEN' | 'CONFLICT'>;
  transactPut(items: StoredItem[]): Promise<'WRITTEN' | 'CONFLICT'>;
  delete(pk: string, sk: string): Promise<void>;
}

export class DynamoDbRepositoryStore implements RepositoryStore {
  private readonly client: DynamoDBDocumentClient;
  constructor(
    private readonly tableName: string,
    client?: DynamoDBDocumentClient,
  ) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async put(item: StoredItem, createOnly = false): Promise<'WRITTEN' | 'CONFLICT'> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ...(createOnly ? { ConditionExpression: 'attribute_not_exists(pk)' } : {}),
        }),
      );
      return 'WRITTEN';
    } catch (error) {
      return conditional(error);
    }
  }

  async get(pk: string, sk: string): Promise<StoredItem | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk, sk }, ConsistentRead: true }),
    );
    return result.Item as StoredItem | undefined;
  }

  async query(input: QueryInput): Promise<StoredItem[]> {
    const partitionName = input.partitionName ?? 'pk';
    const names: Record<string, string> = { '#partition': partitionName };
    const values: Record<string, unknown> = { ':partition': input.partitionValue };
    let expression = '#partition = :partition';
    if (input.beginsWith) {
      names['#sort'] = input.indexName
        ? input.indexName.startsWith('gsi1')
          ? 'gsi1sk'
          : input.indexName.startsWith('gsi2')
            ? 'gsi2sk'
            : input.indexName.startsWith('gsi3')
              ? 'gsi3sk'
              : 'gsi4sk'
        : 'sk';
      values[':prefix'] = input.beginsWith;
      expression += ' AND begins_with(#sort, :prefix)';
    }
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        ...(input.indexName ? { IndexName: input.indexName } : {}),
        KeyConditionExpression: expression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
    return (result.Items ?? []) as StoredItem[];
  }

  async updateCase(item: StoredItem, expectedRevision: number): Promise<'WRITTEN' | 'CONFLICT'> {
    try {
      const names: Record<string, string> = { '#revision': 'revision' };
      const values: Record<string, unknown> = { ':expected': expectedRevision };
      const updates: string[] = [];
      for (const [name, value] of Object.entries(item)) {
        if (name === 'pk' || name === 'sk' || name === 'entity_type') continue;
        const token = `#f${updates.length}`;
        const valueToken = `:v${updates.length}`;
        names[token] = name;
        values[valueToken] = value;
        updates.push(`${token} = ${valueToken}`);
      }
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: item.pk, sk: item.sk },
          ConditionExpression: '#revision = :expected',
          UpdateExpression: `SET ${updates.join(', ')}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        }),
      );
      return 'WRITTEN';
    } catch (error) {
      return conditional(error);
    }
  }

  async transactPut(items: StoredItem[]): Promise<'WRITTEN' | 'CONFLICT'> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: items.map((item) => ({
            Put: {
              TableName: this.tableName,
              Item: item,
              ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
            },
          })),
        }),
      );
      return 'WRITTEN';
    } catch (error) {
      return conditional(error);
    }
  }

  async delete(pk: string, sk: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { pk, sk } }));
  }
}

function conditional(error: unknown): 'CONFLICT' {
  if (
    error instanceof ConditionalCheckFailedException ||
    error instanceof TransactionCanceledException ||
    (error instanceof Error &&
      (error.name === 'ConditionalCheckFailedException' ||
        error.name === 'TransactionCanceledException'))
  )
    return 'CONFLICT';
  throw error;
}
