import { assertValidAiOutput } from '@returnshield/contracts';
import { RepositoryConflictError } from '@returnshield/data';
import type { JsonObject, Repositories, ReturnCase } from '@returnshield/data';

import type { InvestigatorModelClient } from './ai/client.js';
import { INVESTIGATOR_PROMPT_VERSION } from './ai/prompt.js';
import { validateInvestigatorOutput } from './ai/validator.js';
import {
  InvestigationCaseMissingError,
  InvestigationEventError,
  InvestigationIntegrityError,
  InvestigatorTransportError,
  InvestigatorValidationError,
} from './errors.js';
import { toInvestigatorInput } from './input.js';
import { assertDeterministicFieldsUnchanged } from './integrity.js';
import { logInvestigation } from './logger.js';
import type { InvestigationLogFields } from './logger.js';
import type {
  InvestigationOutcome,
  InvestigationResult,
  InvestigatorInput,
  InvestigatorOutput,
  ReviewEventDetail,
} from './types.js';

const MAX_WRITE_ATTEMPTS = 3;

export interface InvestigationDependencies {
  repositories: Pick<Repositories, 'cases'>;
  client: InvestigatorModelClient;
  now?: () => string;
  log?: (fields: InvestigationLogFields) => void;
}

type Plan = (fresh: ReturnCase) => ReturnCase | 'SKIP';

/** Stable timeline entry ID: one explanation entry per case, however often the event arrives. */
export function explanationTimelineId(caseId: string): string {
  return `${caseId}-EXPLANATION_AVAILABLE`;
}

function parseReviewEvent(raw: unknown): ReviewEventDetail {
  try {
    return assertValidAiOutput<ReviewEventDetail>('ReviewEvent', raw);
  } catch (error) {
    throw new InvestigationEventError(
      error instanceof Error ? error.message : 'Review event failed contract validation',
    );
  }
}

/** True once an explanation outcome is final, or its timeline entry already exists. */
function isSettled(value: ReturnCase): boolean {
  return (
    value.explanation_status === 'AVAILABLE' ||
    value.explanation_status === 'UNAVAILABLE' ||
    value.timeline.some((entry) => entry.event_id === explanationTimelineId(value.case_id))
  );
}

function classify(
  value: ReturnCase,
  event: ReviewEventDetail,
): 'ELIGIBLE' | 'DUPLICATE' | 'NOT_ELIGIBLE' {
  if (
    value.status !== 'DECIDED' ||
    value.decision !== 'NEEDS_REVIEW' ||
    value.order_id !== event.order_id ||
    value.seller_id !== event.seller_id ||
    value.listing_id !== event.listing_id ||
    value.policy_version !== event.policy_version ||
    value.risk_score !== event.risk_score ||
    value.priority !== event.priority
  )
    return 'NOT_ELIGIBLE';
  if (isSettled(value)) return 'DUPLICATE';
  return value.explanation_status === 'PENDING' || value.explanation_status === 'RETRY_PENDING'
    ? 'ELIGIBLE'
    : 'NOT_ELIGIBLE';
}

/** Only the explanation fields, revision, timestamp and (on success) timeline may differ. */
function withExplanation(
  fresh: ReturnCase,
  status: 'AVAILABLE' | 'RETRY_PENDING' | 'UNAVAILABLE',
  explanation: InvestigatorOutput | null,
  timestamp: string,
): ReturnCase {
  const timeline: JsonObject[] =
    status === 'AVAILABLE'
      ? [
          ...fresh.timeline,
          {
            schema_version: '1.0.0',
            event_id: explanationTimelineId(fresh.case_id),
            case_id: fresh.case_id,
            timestamp,
            type: 'EXPLANATION_AVAILABLE',
            actor_id: 'SYSTEM',
            message: 'EXPLANATION_AVAILABLE',
          },
        ]
      : fresh.timeline;
  return {
    ...fresh,
    explanation_status: status,
    explanation: explanation as unknown as JsonObject | null,
    timeline,
    revision: fresh.revision + 1,
    updated_at: timestamp,
  };
}

/**
 * Optimistic write loop. Every attempt re-reads the persisted case, lets the
 * plan decide (or skip because another delivery already settled it), proves
 * that no deterministic field changed, and writes by revision.
 */
async function commit(
  deps: InvestigationDependencies,
  caseId: string,
  plan: Plan,
): Promise<'WRITTEN' | 'SKIPPED'> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const fresh = await deps.repositories.cases.get(caseId);
    if (!fresh) throw new InvestigationCaseMissingError(caseId);
    const next = plan(fresh);
    if (next === 'SKIP') return 'SKIPPED';
    assertDeterministicFieldsUnchanged(fresh, next);
    try {
      await deps.repositories.cases.update(next, fresh.revision);
      return 'WRITTEN';
    } catch (error) {
      if (!(error instanceof RepositoryConflictError)) throw error;
    }
  }
  throw new Error('Explanation write conflicted repeatedly');
}

/**
 * Handles one RETURN_NEEDS_REVIEW event. The deterministic case is the source
 * of truth and is never altered: model output only ever becomes an explanation
 * after schema and grounding validation, and every failure path leaves the
 * case usable with an `UNAVAILABLE` or `RETRY_PENDING` explanation status.
 */
export async function investigateReviewEvent(
  rawEvent: unknown,
  deps: InvestigationDependencies,
): Promise<InvestigationResult> {
  const log = deps.log ?? logInvestigation;
  const now = deps.now ?? (() => new Date().toISOString());
  const event = parseReviewEvent(rawEvent);
  const finish = (outcome: InvestigationOutcome, category?: string): InvestigationResult => {
    log({
      event: 'investigation.outcome',
      outcome,
      case_id: event.case_id,
      review_event_id: event.event_id,
      model_id: deps.client.modelId,
      prompt_version: INVESTIGATOR_PROMPT_VERSION,
      ...(category ? { category } : {}),
    });
    return { outcome, case_id: event.case_id };
  };

  const current = await deps.repositories.cases.get(event.case_id);
  if (!current) throw new InvestigationCaseMissingError(event.case_id);
  const eligibility = classify(current, event);
  if (eligibility === 'DUPLICATE') return finish('DUPLICATE_IGNORED');
  if (eligibility === 'NOT_ELIGIBLE') return finish('NOT_ELIGIBLE');

  const settle = async (
    status: 'RETRY_PENDING' | 'UNAVAILABLE',
    category: string,
  ): Promise<InvestigationResult> => {
    const written = await commit(deps, event.case_id, (fresh) => {
      if (
        isSettled(fresh) ||
        (status === 'RETRY_PENDING' && fresh.explanation_status !== 'PENDING')
      )
        return 'SKIP';
      return withExplanation(fresh, status, null, now());
    });
    return written === 'SKIPPED' ? finish('DUPLICATE_IGNORED') : finish(status, category);
  };

  let input: InvestigatorInput;
  try {
    input = toInvestigatorInput(current);
  } catch (error) {
    if (error instanceof InvestigationIntegrityError) return settle('UNAVAILABLE', 'INTEGRITY');
    throw error;
  }

  const finalAttempt = current.explanation_status === 'RETRY_PENDING';
  let text: string;
  try {
    text = (await deps.client.investigate(input)).text;
  } catch (error) {
    if (error instanceof InvestigatorTransportError) {
      return error.retriable && !finalAttempt
        ? settle('RETRY_PENDING', error.kind)
        : settle('UNAVAILABLE', error.kind);
    }
    if (error instanceof InvestigatorValidationError) return settle('UNAVAILABLE', error.category);
    return settle('UNAVAILABLE', 'UNEXPECTED_MODEL_ERROR');
  }

  let output: InvestigatorOutput;
  try {
    output = validateInvestigatorOutput(text, input);
  } catch (error) {
    if (error instanceof InvestigatorValidationError) return settle('UNAVAILABLE', error.category);
    throw error;
  }

  const written = await commit(deps, event.case_id, (fresh) => {
    if (isSettled(fresh)) return 'SKIP';
    if (JSON.stringify(fresh.evidence) !== JSON.stringify(current.evidence))
      throw new InvestigationIntegrityError(
        'Case evidence changed while the explanation was built',
      );
    return withExplanation(fresh, 'AVAILABLE', output, now());
  });
  return written === 'SKIPPED' ? finish('DUPLICATE_IGNORED') : finish('EXPLAINED');
}
