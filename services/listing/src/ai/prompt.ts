import { SCHEMA_VERSION } from '@returnshield/contracts';

import type { ListingInput } from '../types.js';

export const LISTING_GUARD_PROMPT_VERSION = '1.0.0';

export function buildListingGuardPrompt(input: ListingInput): string {
  return [
    'You are ReturnShield ListingGuard. Return JSON only, with no markdown.',
    'Evaluate listing quality and policy risk using only the supplied title, description, and category.',
    'Do not infer seller history, customer behavior, returns, fraud, or facts outside the input.',
    'PASS must have severity low, no issues, and no evidence. Use CORRECTION_REQUIRED for any material contradiction, missing detail, or policy concern.',
    'Every issue must cite one or more evidence IDs, and every evidence quote must be an exact substring of the supplied field.',
    'Do not add commentary, markdown, code fences, or unescaped quotation marks inside JSON strings.',
    `Return this exact shape and schema_version ${SCHEMA_VERSION}:`,
    '{"schema_version":"1.0.0","status":"PASS|CORRECTION_REQUIRED","severity":"low|medium|high","issues":[{"issue_id":"...","description":"...","evidence_refs":["..."]}],"evidence":[{"evidence_id":"...","field":"title|description|category","quote":"..."}],"recommended_action":"..."}',
    'Input:',
    JSON.stringify({
      schema_version: input.schema_version,
      title: input.title,
      description: input.description,
      category: input.category,
    }),
  ].join('\n');
}
