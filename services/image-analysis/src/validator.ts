/**
 * Phase 07A (task P7A-AI-01) strict validation of raw `amazon.nova-lite-v1:0`
 * output. Untrusted until it passes `assertValidImageAiOutput` — the schema
 * itself makes it impossible for a validated result to carry a score,
 * decision, priority, contribution, accusation, identity or medical
 * inference (CODING-RULES.md rule 5/6).
 */
import { assertValidImageAiOutput } from '@returnshield/contracts';

export interface ImageAnalysisOutput {
  schema_version: '1.0.0';
  summary: string;
  findings: string[];
  evidence_refs: string[];
  recommended_action: 'NONE' | 'FLAG_FOR_REVIEW';
}

export class ImageAnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageAnalysisValidationError';
  }
}

const FORBIDDEN =
  /\b(fraud(?:ster)?|scam(?:mer)?|criminal|diagnos(?:e|is)|medical condition|identity is|risk score|auto[_ -]?approve|decline(?:d)?|guilty)\b/i;

export function validateImageAnalysisOutput(
  payload: unknown,
  expectedImageId?: string,
): ImageAnalysisOutput {
  try {
    const value = assertValidImageAiOutput<ImageAnalysisOutput>('ImageAnalysisOutput', payload);
    if (
      expectedImageId &&
      (value.evidence_refs.length !== 1 || value.evidence_refs[0] !== expectedImageId)
    ) {
      throw new ImageAnalysisValidationError('Output cited unsupported image evidence');
    }
    if ([value.summary, ...value.findings].some((text) => FORBIDDEN.test(text))) {
      throw new ImageAnalysisValidationError('Output contains a prohibited inference');
    }
    return value;
  } catch (error) {
    throw new ImageAnalysisValidationError(
      error instanceof Error ? error.message : 'Invalid image analysis output',
    );
  }
}
