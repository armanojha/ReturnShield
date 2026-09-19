import { assertValidAiOutput } from '@returnshield/contracts';

import type { ListingInput } from '../types.js';

export interface ListingGuardOutput {
  schema_version: '1.0.0';
  status: 'PASS' | 'CORRECTION_REQUIRED';
  severity: 'low' | 'medium' | 'high';
  issues: Array<{ issue_id: string; description: string; evidence_refs: string[] }>;
  evidence: Array<{
    evidence_id: string;
    field: 'title' | 'description' | 'category';
    quote: string;
  }>;
  recommended_action: string;
}

export class ListingGuardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ListingGuardValidationError';
  }
}

function assertGrounded(output: ListingGuardOutput, input: ListingInput): void {
  const fields = { title: input.title, description: input.description, category: input.category };
  const evidenceIds = new Set<string>();
  for (const evidence of output.evidence) {
    if (evidenceIds.has(evidence.evidence_id))
      throw new ListingGuardValidationError('Duplicate evidence ID');
    evidenceIds.add(evidence.evidence_id);
    if (!fields[evidence.field].includes(evidence.quote))
      throw new ListingGuardValidationError(
        'Evidence quote is not grounded in submitted listing content',
      );
  }
  for (const issue of output.issues)
    for (const ref of issue.evidence_refs)
      if (!evidenceIds.has(ref))
        throw new ListingGuardValidationError('Issue references unknown evidence');
}

export function validateListingGuardOutput(
  payload: unknown,
  input: ListingInput,
): ListingGuardOutput {
  let output: ListingGuardOutput;
  try {
    output = assertValidAiOutput<ListingGuardOutput>('ListingGuardOutput', payload);
  } catch (error) {
    throw new ListingGuardValidationError(
      error instanceof Error ? error.message : 'Invalid AI output',
    );
  }
  try {
    assertGrounded(output, input);
  } catch (error) {
    if (error instanceof ListingGuardValidationError) throw error;
    throw new ListingGuardValidationError('AI evidence validation failed');
  }
  return output;
}
