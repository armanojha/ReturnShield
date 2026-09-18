import { assertValid } from '@returnshield/contracts';
import stories from '../../../../contracts/seeds/stories.json';

/** Development/test fixtures only. They are never selected by the production API client. */
export const FIXTURE_SOURCE = 'contracts/seeds/stories.json' as const;
const [clean, review, high] = stories.stories;
if (!clean || !review || !high) throw new Error('Frozen seed stories are incomplete');

const envelope = <T>(data: T, correlation: string) => ({
  schema_version: '1.0.0',
  correlation_id: correlation,
  data,
});

export const healthFixture = assertValid(
  'HealthResponse',
  envelope({ service: 'returnshield', status: 'ok' }, 'FIXTURE-health'),
);
export const listingFixtures = [clean, review, high].map((story) =>
  assertValid('ListingResponse', envelope(story.listing, `FIXTURE-listing-${story.story_id}`)),
);
export const returnFixtures = [clean, review, high].map((story) =>
  assertValid(
    'ReturnResponse',
    envelope({ case: story.expected_case, replayed: false }, `FIXTURE-return-${story.story_id}`),
  ),
);
export const caseListFixture = assertValid(
  'CasesResponse',
  envelope(
    { items: [high.expected_case, review.expected_case, clean.expected_case], next_cursor: null },
    'FIXTURE-cases',
  ),
);
export const caseDetailFixtures = [clean, review, high].map((story) =>
  assertValid('CaseResponse', envelope(story.expected_case, `FIXTURE-case-${story.story_id}`)),
);
export const sellerFixtures = [clean, review, high].map((story) =>
  assertValid('SellerResponse', envelope(story.seller, `FIXTURE-seller-${story.story_id}`)),
);
export const dashboardFixture = assertValid(
  'DashboardResponse',
  envelope(
    {
      as_of: '2026-09-01T12:00:00Z',
      flagged_listings: 1,
      auto_approved_returns: 1,
      normal_review_cases: 1,
      high_review_cases: 1,
      open_review_cases: 2,
      missing_context_cases: 0,
    },
    'FIXTURE-dashboard',
  ),
);

const decidedAt = '2026-09-01T12:05:00Z';
const reviewedCase = {
  ...review.expected_case,
  revision: review.expected_case.revision + 1,
  review_status: 'RESOLVED',
  reviewer_disposition: {
    schema_version: '1.0.0',
    action: 'APPROVE_RETURN',
    actor_id: 'REVIEWER-synthetic',
    note: 'Synthetic fixture disposition.',
    decided_at: decidedAt,
  },
  timeline: [
    ...review.expected_case.timeline,
    {
      schema_version: '1.0.0',
      event_id: 'CASE-review-REVIEWER_DECISION',
      case_id: 'CASE-review',
      timestamp: decidedAt,
      type: 'REVIEWER_DECISION',
      actor_id: 'REVIEWER-synthetic',
      message: 'Synthetic fixture disposition.',
    },
  ],
  updated_at: decidedAt,
};
export const reviewerDecisionFixture = assertValid(
  'DecisionResponse',
  envelope(reviewedCase, 'FIXTURE-decision'),
);

export const errorFixtures = {
  validation: assertValid('Error', {
    schema_version: '1.0.0',
    correlation_id: 'FIXTURE-error-validation',
    error: {
      code: 'VALIDATION_ERROR',
      message: 'The request did not satisfy the contract.',
      retryable: false,
      details: [{ field: 'order_id', message: 'is required' }],
    },
  }),
  missingContext: assertValid('Error', {
    schema_version: '1.0.0',
    correlation_id: 'FIXTURE-error-context',
    error: {
      code: 'ERROR_MISSING_CONTEXT',
      message: 'Required synthetic context is unavailable.',
      retryable: false,
      details: [{ field: 'seller', message: 'not available' }],
    },
  }),
  unavailable: assertValid('Error', {
    schema_version: '1.0.0',
    correlation_id: 'FIXTURE-error-unavailable',
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Service temporarily unavailable.',
      retryable: true,
      details: [],
    },
  }),
} as const;

export const fixtureUiStates = {
  loading: { status: 'loading' },
  networkFailure: { status: 'error', kind: 'network', message: 'Fixture network failure.' },
} as const;
