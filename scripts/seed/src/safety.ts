export type SeedEnvironment = 'dev' | 'test' | 'local';

export function assertSafeSeedTarget(
  input: { environment?: string; tableName?: string; endpoint?: string; confirmation?: string },
  destructive: boolean,
): { environment: SeedEnvironment; tableName: string } {
  const environment = input.environment;
  const tableName = input.tableName;
  if (!environment || !['dev', 'test', 'local'].includes(environment))
    throw new Error('Seed environment must be dev, test or local; production is forbidden');
  if (!tableName || !/^returnshield-(dev|test|local)-core$/.test(tableName))
    throw new Error('Table name must be an isolated ReturnShield dev/test/local core table');
  if (environment === 'local' && !input.endpoint)
    throw new Error('Local environment requires an explicit DynamoDB endpoint');
  if (environment !== 'local' && input.endpoint)
    throw new Error('Endpoint override is allowed only for local test DynamoDB');
  if (destructive && input.confirmation !== tableName)
    throw new Error(`Reset requires --confirm ${tableName}`);
  return { environment: environment as SeedEnvironment, tableName };
}
