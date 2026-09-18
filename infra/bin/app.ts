#!/usr/bin/env node
import { App } from 'aws-cdk-lib';

import {
  ENVIRONMENTS,
  ReturnShieldStack,
  isEnvironmentName,
  resourceName,
} from '../lib/returnshield-stack';

const app = new App();

const requested =
  (app.node.tryGetContext('envName') as string | undefined) ??
  process.env.RETURNSHIELD_ENV ??
  'dev';

if (!isEnvironmentName(requested)) {
  throw new Error(
    `Unknown environment "${requested}". Expected one of: ${ENVIRONMENTS.join(', ')}. ` +
      'Pass it with `cdk synth -c envName=dev` or set RETURNSHIELD_ENV.',
  );
}

// Account and region are resolved from the deploying CLI session. They are
// never written into this repository.
new ReturnShieldStack(app, resourceName(requested, 'base'), {
  envName: requested,
  description: `ReturnShield base stack (${requested}) — API Gateway, health Lambda, data placeholder, logs.`,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION,
  },
});

app.synth();
