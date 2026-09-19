import { describe, expect, it } from 'vitest';

import { buildListingGuardPrompt } from '../src/ai/prompt.js';
import { ListingGuardValidationError, validateListingGuardOutput } from '../src/ai/validator.js';
import type { ListingInput } from '../src/types.js';

const input: ListingInput = {
  schema_version: '1.0.0',
  listing_id: 'LISTING-test',
  seller_id: 'SELLER-test',
  title: 'Wireless headphones',
  description: 'Black headphones with USB-C charging.',
  category: 'ELECTRONICS',
};

const pass = {
  schema_version: '1.0.0',
  status: 'PASS',
  severity: 'low',
  issues: [],
  evidence: [],
  recommended_action: 'No correction required.',
};

describe('ListingGuard validation', () => {
  it('accepts a clean validated result', () => {
    expect(validateListingGuardOutput(pass, input).status).toBe('PASS');
  });

  it('accepts a contradiction only when evidence is grounded in submitted content', () => {
    const output = {
      schema_version: '1.0.0',
      status: 'CORRECTION_REQUIRED',
      severity: 'medium',
      issues: [
        {
          issue_id: 'ISSUE-1',
          description: 'Category conflicts with the description.',
          evidence_refs: ['EVIDENCE-1'],
        },
      ],
      evidence: [{ evidence_id: 'EVIDENCE-1', field: 'description', quote: 'USB-C charging' }],
      recommended_action: 'Clarify the product description.',
    };
    expect(validateListingGuardOutput(output, input).status).toBe('CORRECTION_REQUIRED');
  });

  it('rejects malformed output and ungrounded evidence', () => {
    expect(() => validateListingGuardOutput({ ...pass, status: 'BROKEN' }, input)).toThrow(
      ListingGuardValidationError,
    );
    expect(() =>
      validateListingGuardOutput(
        {
          ...pass,
          status: 'CORRECTION_REQUIRED',
          severity: 'medium',
          issues: [
            {
              issue_id: 'ISSUE-1',
              description: 'Unsupported claim.',
              evidence_refs: ['EVIDENCE-1'],
            },
          ],
          evidence: [{ evidence_id: 'EVIDENCE-1', field: 'title', quote: 'not submitted' }],
        },
        input,
      ),
    ).toThrow('grounded');
  });

  it('includes only supplied content in the prompt', () => {
    const prompt = buildListingGuardPrompt(input);
    expect(prompt).toContain(input.title);
    expect(prompt).toContain(input.description);
    expect(prompt).toContain(input.category);
    expect(prompt).not.toContain(input.seller_id);
  });
});
