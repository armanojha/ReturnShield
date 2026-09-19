import type {
  EvidenceKind,
  RiskContribution,
  RiskEvaluationInput,
  RiskPolicyConfig,
  RiskSignal,
  SignalEvaluation,
} from '../types';

/** Evidence id pattern from the frozen entities contract. */
const EVIDENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export function isRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Seller and customer history signals require fully loaded history windows. */
export function historyMissingFields(input: RiskEvaluationInput): string[] {
  return input.history_complete === true ? [] : ['history_complete'];
}

/** Valid, de-duplicated evidence ids of one kind, in input order. */
export function evidenceRefsFor(input: RiskEvaluationInput, kind: EvidenceKind): string[] {
  const refs: string[] = [];
  for (const item of input.evidence ?? []) {
    if (
      item.kind === kind &&
      typeof item.evidence_id === 'string' &&
      EVIDENCE_ID_PATTERN.test(item.evidence_id) &&
      !refs.includes(item.evidence_id)
    ) {
      refs.push(item.evidence_id);
    }
  }
  return refs;
}

export function missingEvidenceFields(kind: EvidenceKind, refs: readonly string[]): string[] {
  return refs.length > 0 ? [] : [`evidence.${kind}`];
}

export function missingContext(fields: readonly string[]): SignalEvaluation {
  return { status: 'MISSING_CONTEXT', missing_fields: [...fields] };
}

export function contributionOutcome(
  policy: RiskPolicyConfig,
  signal: RiskSignal,
  max: number,
  triggered: boolean,
  reason: string,
  evidenceRefs: readonly string[],
): SignalEvaluation {
  const contribution: RiskContribution = {
    schema_version: policy.schema_version,
    signal,
    points: triggered ? max : 0,
    max,
    reason,
    evidence_refs: [...evidenceRefs],
  };
  return { status: 'OK', contribution };
}
