import { assertValidAiOutput } from '@returnshield/contracts';
import type { ReturnCase } from '@returnshield/data';

import { buildEvidenceAllowlist } from './ai/allowlist.js';
import { InvestigationIntegrityError } from './errors.js';
import type { InvestigatorInput, PolicyContribution } from './types.js';

/**
 * Builds the frozen `InvestigatorInput` from the persisted case only. Nothing
 * else (no reviewer data, no other cases, no live lookups) reaches the model.
 * Any inconsistency in the persisted case is an integrity error, not a reason
 * to guess.
 */
export function toInvestigatorInput(persisted: ReturnCase): InvestigatorInput {
  if (
    persisted.status !== 'DECIDED' ||
    persisted.decision !== 'NEEDS_REVIEW' ||
    persisted.raw_contribution_total === null ||
    persisted.risk_score === null ||
    persisted.priority === null
  )
    throw new InvestigationIntegrityError('Case is not a decided review case');
  const contributions: PolicyContribution[] = persisted.contributions.map((item) => {
    if (item.signal === 'context' || item.contribution === null || item.max === null)
      throw new InvestigationIntegrityError('Case carries a non-policy contribution');
    return {
      schema_version: '1.0.0',
      signal: item.signal,
      points: item.contribution,
      max: item.max,
      reason: item.reason,
      evidence_refs: [...item.evidence_refs],
    };
  });
  const input: InvestigatorInput = {
    schema_version: '1.0.0',
    case_id: persisted.case_id,
    policy_result: {
      schema_version: '1.0.0',
      policy_version: persisted.policy_version,
      raw_contribution_total: persisted.raw_contribution_total,
      score: persisted.risk_score,
      decision: persisted.decision,
      priority: persisted.priority,
      contributions,
    },
    evidence: persisted.evidence.map((item) => ({ ...item })),
    allowed_evidence_ids: buildEvidenceAllowlist(persisted),
  };
  try {
    return assertValidAiOutput<InvestigatorInput>('InvestigatorInput', input);
  } catch (error) {
    throw new InvestigationIntegrityError(
      error instanceof Error ? error.message : 'Investigator input failed contract validation',
    );
  }
}
