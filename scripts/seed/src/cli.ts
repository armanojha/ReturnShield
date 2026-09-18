import { DynamoDbSeedTarget, loadSeeds, resetSeeds, verifySeeds } from './operations.js';
import { assertSafeSeedTarget } from './safety.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const action = process.argv[2];
if (!['load', 'reset', 'verify'].includes(action ?? ''))
  throw new Error(
    'Usage: npm run seed -- <load|reset|verify> --env dev --table returnshield-dev-core [--confirm TABLE]',
  );
const endpoint = argument('endpoint');
const environment = argument('env');
const tableName = argument('table');
const confirmation = argument('confirm');
const safe = assertSafeSeedTarget(
  {
    ...(environment ? { environment } : {}),
    ...(tableName ? { tableName } : {}),
    ...(endpoint ? { endpoint } : {}),
    ...(confirmation ? { confirmation } : {}),
  },
  action === 'reset',
);
const region = argument('region') ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const target = new DynamoDbSeedTarget(safe.tableName, {
  ...(endpoint ? { endpoint } : {}),
  ...(region ? { region } : {}),
});
if (action === 'load') await loadSeeds(target);
if (action === 'reset') await resetSeeds(target);
if (action === 'verify') {
  const result = await verifySeeds(target);
  if (!result.ok) {
    process.stderr.write(
      `${JSON.stringify({ event: 'seed.verify', outcome: 'failure', errors: result.errors })}\n`,
    );
    process.exitCode = 1;
  } else
    process.stdout.write(
      `${JSON.stringify({ event: 'seed.verify', outcome: 'success', counts: { sellers: 3, listings: 3, customers: 3, orders: 3, return_cases: 0, risk_events: 0 } })}\n`,
    );
} else
  process.stdout.write(
    `${JSON.stringify({ event: `seed.${action}`, outcome: 'success', environment: safe.environment, table: safe.tableName })}\n`,
  );
