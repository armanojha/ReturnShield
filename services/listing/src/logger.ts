export function logListingFailure(fields: {
  event: string;
  correlation_id: string;
  stage: string;
  error_kind: string;
}): void {
  console.error(
    JSON.stringify({
      service: 'returnshield',
      level: 'error',
      timestamp: new Date().toISOString(),
      outcome: 'failure',
      ...fields,
    }),
  );
}
