import type { Listing } from '@returnshield/data';

import { LISTING_GUARD_PROMPT_VERSION } from './prompt.js';
import type { ListingGuardOutput } from './validator.js';
import type { ListingInput } from '../types.js';

export function mapListingAnalysis(
  input: ListingInput,
  output: ListingGuardOutput,
  metadata: { model_id: string; correlation_id: string },
): Listing {
  return {
    ...input,
    listing_risk: output.severity,
    status: output.status,
    analysis: output as unknown as Listing['analysis'],
    analysis_metadata: {
      model_id: metadata.model_id,
      prompt_version: LISTING_GUARD_PROMPT_VERSION,
      schema_version: input.schema_version,
      validation_result: 'VALID',
      correlation_id: metadata.correlation_id,
    },
    created_at: new Date().toISOString(),
  };
}
