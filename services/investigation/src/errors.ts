/** Categories are log-safe: they never carry model output or evidence text. */
export type ValidationCategory =
  | 'MALFORMED_OUTPUT'
  | 'OUTPUT_TOO_LARGE'
  | 'SCHEMA_INVALID'
  | 'UNSUPPORTED_EVIDENCE'
  | 'UNSUPPORTED_CLAIM';

/** Model output failed parsing, schema validation or grounding. It is never persisted. */
export class InvestigatorValidationError extends Error {
  constructor(
    public readonly category: ValidationCategory,
    message: string,
  ) {
    super(message);
    this.name = 'InvestigatorValidationError';
  }
}

export type TransportKind = 'TIMEOUT' | 'THROTTLED' | 'SERVICE_ERROR' | 'NETWORK' | 'REJECTED';

/** Bedrock could not produce a response. `retriable` failures may be attempted once more. */
export class InvestigatorTransportError extends Error {
  constructor(
    public readonly kind: TransportKind,
    public readonly retriable: boolean,
  ) {
    super(`Investigator model call failed: ${kind}`);
    this.name = 'InvestigatorTransportError';
  }
}

/** Persisted case data is not internally consistent enough to ground an explanation. */
export class InvestigationIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvestigationIntegrityError';
  }
}

/** The incoming event is not a valid RETURN_NEEDS_REVIEW detail. */
export class InvestigationEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvestigationEventError';
  }
}

export class InvestigationCaseMissingError extends Error {
  constructor(public readonly caseId: string) {
    super('Case referenced by the review event was not found');
    this.name = 'InvestigationCaseMissingError';
  }
}

/** Thrown by the handler so asynchronous invocation retries once after a transient failure. */
export class InvestigationRetryRequested extends Error {
  constructor(public readonly caseId: string) {
    super('Investigation will be retried after a transient model failure');
    this.name = 'InvestigationRetryRequested';
  }
}
