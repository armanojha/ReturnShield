/**
 * Structured JSON logging for the health service.
 *
 * Every line carries `service`, `event`, `correlation_id` and `outcome` as
 * required by Phase 01. Lambda stdout is the CloudWatch transport, so `console`
 * is the sanctioned sink here (see the eslint override for this file).
 *
 * Log lines never contain request bodies, headers, credentials or raw model
 * output, per the security rules in the vault.
 */
import { SERVICE_NAME } from '@returnshield/contracts';

export type LogOutcome = 'success' | 'failure';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): LogLevel {
  const raw = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase();
  return raw in LEVEL_ORDER ? (raw as LogLevel) : 'info';
}

export interface LogFields {
  /** Stable event name, e.g. `health.request`. */
  event: string;
  correlation_id: string;
  outcome: LogOutcome;
  /** Optional, log-safe extras. Never include payloads or secrets. */
  [key: string]: unknown;
}

export interface LogRecord extends LogFields {
  service: string;
  level: LogLevel;
  timestamp: string;
}

/** Builds the record without writing it, so tests can assert its shape. */
export function buildRecord(level: LogLevel, fields: LogFields): LogRecord {
  return {
    ...fields,
    service: SERVICE_NAME,
    level,
    timestamp: new Date().toISOString(),
  };
}

function write(level: LogLevel, fields: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configuredLevel()]) return;
  const line = JSON.stringify(buildRecord(level, fields));
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (fields: LogFields) => write('debug', fields),
  info: (fields: LogFields) => write('info', fields),
  warn: (fields: LogFields) => write('warn', fields),
  error: (fields: LogFields) => write('error', fields),
};
