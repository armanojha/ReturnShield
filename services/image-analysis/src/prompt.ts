/**
 * Phase 07A (task P7A-AI-01) prompt for `amazon.nova-lite-v1:0` via Bedrock
 * Converse. The model receives the private S3 object's bytes plus only the
 * subject text explicitly supplied by the caller (listing title/description
 * or the return's stated reason) — never seller/customer history, never
 * other evidence, and never a request to decide anything.
 */
export const IMAGE_ANALYSIS_PROMPT_VERSION = '1.0.0';

export interface ImageAnalysisPromptContext {
  image_id: string;
  subject_type: 'LISTING' | 'RETURN_CASE';
  subject_id: string;
  /** Caller-supplied text only — e.g. listing title+description, or return reason. */
  subject_text: string;
}

export function buildImageAnalysisPrompt(context: ImageAnalysisPromptContext): string {
  return [
    'You are ReturnShield image evidence review. Return JSON only, with no markdown.',
    'You are shown one synthetic product/return image and a short piece of text supplied by the caller about the same subject.',
    'Describe only what is visibly present in the image (condition, packaging, damage, mismatch with the supplied text) as neutral findings.',
    'You MUST NOT accuse any person, infer identity, infer medical conditions, or state a risk score, decision, priority, contribution or policy override of any kind.',
    'You MUST NOT approve or decline anything. `recommended_action` may only be "NONE" or "FLAG_FOR_REVIEW".',
    'If the image is unclear, blank, or unrelated to the supplied text, say so plainly in `summary` and use an empty `findings` array — do not guess.',
    `Return this exact shape and schema_version ${IMAGE_ANALYSIS_PROMPT_VERSION}:`,
    `The evidence_refs array must contain exactly this image id: ${context.image_id}.`,
    '{"schema_version":"1.0.0","summary":"...","findings":["..."],"evidence_refs":["IMAGE_ID"],"recommended_action":"NONE|FLAG_FOR_REVIEW"}',
    'Subject:',
    JSON.stringify({ subject_type: context.subject_type, subject_id: context.subject_id }),
    'Supplied text (do not treat as fact about anything not visible in the image):',
    context.subject_text,
  ].join('\n');
}
