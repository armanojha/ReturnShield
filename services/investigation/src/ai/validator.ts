import { assertValidAiOutput } from '@returnshield/contracts';

import { InvestigatorValidationError } from '../errors.js';
import type { InvestigatorInput, InvestigatorOutput } from '../types.js';
import { findUnsupportedRefs } from './allowlist.js';

/** Contract limit: model output beyond 32 KiB is rejected before parsing. */
export const MAX_OUTPUT_BYTES = 32 * 1024;

const ACCUSATION =
  /\b(?:fraud\w*|scam\w*|criminal\w*|guilty|liars?|lying|lied|dishonest\w*|cheat\w*|steal\w*|stole\w*|theft|thie(?:f|ves))\b/i;
const FIXED_ID_PREFIXES = ['CASE', 'SELLER', 'CUSTOMER', 'ORDER', 'LISTING', 'EV'];
const ID_LIKE = /\b[A-Z][A-Z0-9]*(?:-[A-Za-z0-9_]+)+/g;
const NUMBER = /\d+(?:\.\d+)?/g;

/**
 * Parses the model's text as a single JSON object. A single Markdown code
 * fence wrapper is tolerated; anything else around the object is rejected.
 */
export function parseModelText(text: string): unknown {
  if (Buffer.byteLength(text, 'utf8') > MAX_OUTPUT_BYTES)
    throw new InvestigatorValidationError('OUTPUT_TOO_LARGE', 'Model output exceeds 32 KiB');
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(unfenced) as unknown;
  } catch {
    throw new InvestigatorValidationError('MALFORMED_OUTPUT', 'Model output is not valid JSON');
  }
}

function numbersIn(text: string): string[] {
  return text.match(NUMBER) ?? [];
}

function knownNumbers(input: InvestigatorInput): Set<string> {
  const numbers = new Set<string>();
  const add = (text: string) => {
    for (const value of numbersIn(text)) {
      numbers.add(value);
      const parsed = Number(value);
      numbers.add(String(parsed));
      // A stored ratio such as 0.25 may legitimately be restated as 25%.
      if (parsed > 0 && parsed < 1) numbers.add(String(Math.round(parsed * 10_000) / 100));
    }
  };
  for (const item of input.evidence) add(item.text);
  for (const id of input.allowed_evidence_ids) add(id);
  add(input.case_id);
  const policy = input.policy_result;
  for (const value of [policy.score, policy.raw_contribution_total]) numbers.add(String(value));
  numbers.add(String(policy.contributions.length));
  numbers.add(String(policy.contributions.filter((item) => item.points > 0).length));
  for (const item of policy.contributions) {
    add(item.reason);
    numbers.add(String(item.points));
    numbers.add(String(item.max));
  }
  return numbers;
}

function knownIds(input: InvestigatorInput): Set<string> {
  return new Set([
    input.case_id,
    ...input.allowed_evidence_ids,
    ...input.evidence.map((item) => item.source_id),
  ]);
}

function assertTextSupported(text: string, numbers: Set<string>, ids: Set<string>): void {
  if (ACCUSATION.test(text))
    throw new InvestigatorValidationError(
      'UNSUPPORTED_CLAIM',
      'Explanation uses accusatory language that the evidence does not support',
    );
  for (const value of numbersIn(text)) {
    const normalized = String(Number(value));
    if (!numbers.has(value) && !numbers.has(normalized))
      throw new InvestigatorValidationError(
        'UNSUPPORTED_CLAIM',
        'Explanation states a number that does not appear in the case evidence',
      );
  }
  const prefixes = new Set([...FIXED_ID_PREFIXES, ...[...ids].map((id) => id.split('-')[0] ?? id)]);
  for (const token of text.match(ID_LIKE) ?? []) {
    const prefix = token.split('-')[0] ?? token;
    if (prefixes.has(prefix) && !ids.has(token))
      throw new InvestigatorValidationError(
        'UNSUPPORTED_CLAIM',
        'Explanation names an identifier that is not part of the case evidence',
      );
  }
}

/**
 * Grounding beyond the schema: every factor must cite only allowlisted
 * evidence, match an active policy signal and cite that signal's own
 * evidence, and no summary or factor text may add numbers, identities or
 * accusations the case does not contain. A lexical check cannot prove
 * semantic support, so it is intentionally conservative.
 */
export function assertGrounded(output: InvestigatorOutput, input: InvestigatorInput): void {
  const allowed = new Set(input.allowed_evidence_ids);
  const contributions = new Map(
    input.policy_result.contributions.map((item) => [item.signal, item] as const),
  );
  const seen = new Set<string>();
  for (const factor of output.factors) {
    if (findUnsupportedRefs(factor.evidence_refs, allowed).length > 0)
      throw new InvestigatorValidationError(
        'UNSUPPORTED_EVIDENCE',
        'A factor references evidence that is not attached to the case',
      );
    const contribution = contributions.get(factor.signal);
    if (!contribution || contribution.points <= 0 || seen.has(factor.signal))
      throw new InvestigatorValidationError(
        'UNSUPPORTED_CLAIM',
        'A factor does not match a distinct, active policy signal',
      );
    seen.add(factor.signal);
    if (!factor.evidence_refs.some((ref) => contribution.evidence_refs.includes(ref)))
      throw new InvestigatorValidationError(
        'UNSUPPORTED_EVIDENCE',
        'A factor does not cite the evidence behind its policy signal',
      );
  }
  const numbers = knownNumbers(input);
  const ids = knownIds(input);
  assertTextSupported(output.summary, numbers, ids);
  for (const factor of output.factors) assertTextSupported(factor.explanation, numbers, ids);
}

/**
 * Turns untrusted model text into a trusted `InvestigatorOutput`, or throws.
 * Nothing about the raw text is retained on failure.
 */
export function validateInvestigatorOutput(
  text: string,
  input: InvestigatorInput,
): InvestigatorOutput {
  const parsed = parseModelText(text);
  let output: InvestigatorOutput;
  try {
    output = assertValidAiOutput<InvestigatorOutput>('InvestigatorOutput', parsed);
  } catch (error) {
    throw new InvestigatorValidationError(
      'SCHEMA_INVALID',
      error instanceof Error ? error.message : 'Model output failed schema validation',
    );
  }
  assertGrounded(output, input);
  return output;
}
