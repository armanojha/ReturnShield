export interface InvestigationLogFields {
  event: string;
  outcome: string;
  case_id?: string;
  review_event_id?: string;
  model_id?: string;
  prompt_version?: string;
  category?: string;
}

/**
 * Structured, log-safe record. It never receives raw model output, prompts or
 * evidence text, so an untrusted response cannot leak into logs as a trusted result.
 */
export function logInvestigation(fields: InvestigationLogFields): void {
  const write = fields.outcome === 'EXPLAINED' ? console.info : console.warn;
  write(
    JSON.stringify({
      service: 'returnshield',
      component: 'investigation',
      timestamp: new Date().toISOString(),
      ...fields,
    }),
  );
}
