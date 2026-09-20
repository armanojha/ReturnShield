import { describe, expect, it } from 'vitest';

import { ImageAnalysisValidationError, validateImageAnalysisOutput } from '../src/validator.js';

const valid = {
  schema_version: '1.0.0',
  summary: 'Item appears new and unopened in the image.',
  findings: ['Packaging looks sealed.'],
  evidence_refs: ['IMG-1'],
  recommended_action: 'NONE',
};

describe('validateImageAnalysisOutput', () => {
  it('accepts a well-formed result', () => {
    expect(validateImageAnalysisOutput(valid, 'IMG-1')).toEqual(valid);
  });

  it('rejects unsupported evidence references and prohibited inferences', () => {
    expect(() => validateImageAnalysisOutput(valid, 'IMG-other')).toThrow(
      ImageAnalysisValidationError,
    );
    expect(() =>
      validateImageAnalysisOutput({ ...valid, summary: 'The customer is a fraudster.' }, 'IMG-1'),
    ).toThrow(ImageAnalysisValidationError);
  });

  it('rejects malformed/missing-field output', () => {
    expect(() => validateImageAnalysisOutput({ summary: 'no other fields' })).toThrow(
      ImageAnalysisValidationError,
    );
  });

  it('rejects a decision-like recommended_action the model was not asked for', () => {
    expect(() =>
      validateImageAnalysisOutput({ ...valid, recommended_action: 'AUTO_APPROVE' }),
    ).toThrow(ImageAnalysisValidationError);
  });

  it('rejects output carrying score/decision/priority-like extra fields', () => {
    expect(() =>
      validateImageAnalysisOutput({ ...valid, risk_score: 80, decision: 'NEEDS_REVIEW' }),
    ).toThrow(ImageAnalysisValidationError);
  });

  it('rejects non-object payloads', () => {
    expect(() => validateImageAnalysisOutput('not json')).toThrow(ImageAnalysisValidationError);
    expect(() => validateImageAnalysisOutput(null)).toThrow(ImageAnalysisValidationError);
  });
});
