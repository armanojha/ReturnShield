export type ListingRisk = 'low' | 'medium' | 'high';

export type ListingStatus =
  | 'PASS'
  | 'CORRECTION_REQUIRED';

export type ReturnReason =
  | 'NOT_AS_DESCRIBED'
  | 'DAMAGED'
  | 'WRONG_ITEM'
  | 'NOT_RECEIVED'
  | 'CHANGED_MIND';

export type CaseStatus =
  | 'PROCESSING'
  | 'DECIDED'
  | 'ERROR_MISSING_CONTEXT'
  | 'FAILED';

export type Priority =
  | 'NONE'
  | 'NORMAL'
  | 'HIGH';

export type ReviewStatus =
  | 'NOT_APPLICABLE'
  | 'OPEN'
  | 'RESOLVED';

export type CaseDecision =
  | 'AUTO_APPROVE'
  | 'NEEDS_REVIEW';

export interface RiskContribution {
  schema_version: '1.0.0';
  risk_event_id: string;
  case_id: string;

  signal:
    | 'seller'
    | 'listing'
    | 'customer'
    | 'return'
    | 'category'
    | 'context';

  contribution: number | null;
  max: number | null;
  reason: string;
  evidence_refs: string[];

  source:
    | 'seller-history'
    | 'listing-analysis'
    | 'customer-history'
    | 'order-return'
    | 'category-policy'
    | 'incomplete-data';

  policy_version: '1.0.0';
  timestamp: string;
}

export type EvidenceKind =
  | 'SELLER_HISTORY'
  | 'LISTING_CONTENT'
  | 'CUSTOMER_HISTORY'
  | 'ORDER_RECORD'
  | 'RETURN_STATEMENT'
  | 'CATEGORY_POLICY'
  | 'CONTEXT_FAILURE';

export interface Evidence {
  schema_version: '1.0.0';
  evidence_id: string;
  kind: EvidenceKind;
  source_id: string;
  text: string;
  observed_at: string;
}

export type TimelineEventType =
  | 'RETURN_RECEIVED'
  | 'POLICY_DECIDED'
  | 'CONTEXT_FAILED'
  | 'WORKFLOW_FAILED'
  | 'REVIEW_REQUESTED'
  | 'EXPLANATION_AVAILABLE'
  | 'EXPLANATION_UNAVAILABLE'
  | 'REVIEWER_DECISION';

export interface TimelineEntry {
  schema_version: '1.0.0';
  event_id: string;
  case_id: string;
  timestamp: string;
  type: TimelineEventType;
  actor_id: string;
  message: string;
}

export interface ReviewerDisposition {
  schema_version: '1.0.0';
  action:
    | 'APPROVE_RETURN'
    | 'DECLINE_RETURN';

  actor_id: string;
  note: string;
  decided_at: string;
}

export interface InvestigatorFactor {
  signal:
    | 'seller'
    | 'listing'
    | 'customer'
    | 'return'
    | 'category';

  explanation: string;
  evidence_refs: string[];
}

export interface InvestigatorOutput {
  schema_version: '1.0.0';
  summary: string;
  factors: InvestigatorFactor[];
  recommended_action: 'HUMAN_REVIEW';
}

export interface CaseError {
  code:
    | 'ERROR_MISSING_CONTEXT'
    | 'WORKFLOW_FAILED';

  missing_fields: string[];
  message: string;
}

export interface ReturnCase {
  schema_version: '1.0.0';

  case_id: string;
  order_id: string;
  seller_id: string;
  listing_id: string;
  customer_id: string;

  reason: ReturnReason;
  evidence: Evidence[];

  status: CaseStatus;
  revision: number;

  raw_contribution_total: number | null;
  risk_score: number | null;

  policy_version: '1.0.0';

  decision: CaseDecision | null;
  priority: Priority | null;

  contributions: RiskContribution[];

  review_status: ReviewStatus;

  reviewer_disposition:
    | ReviewerDisposition
    | null;

  explanation_status:
    | 'NOT_REQUESTED'
    | 'PENDING'
    | 'AVAILABLE'
    | 'UNAVAILABLE'
    | 'RETRY_PENDING';

  explanation:
    | InvestigatorOutput
    | null;

  error: CaseError | null;

  timeline: TimelineEntry[];

  created_at: string;
  updated_at: string;
}

export interface ListingIssue {
  issue_id: string;
  description: string;
  evidence_refs: string[];
}

export interface ListingEvidence {
  evidence_id: string;
  field:
    | 'title'
    | 'description'
    | 'category';
  quote: string;
}

export interface ListingGuardOutput {
  schema_version: '1.0.0';

  status: ListingStatus;
  severity: ListingRisk;

  issues: ListingIssue[];
  evidence: ListingEvidence[];

  recommended_action: string;
}

export interface ListingAnalysisMetadata {
  model_id: string;
  prompt_version: string;
  schema_version: '1.0.0';
  validation_result: 'VALID';
  correlation_id: string;
}

export interface Listing {
  schema_version: '1.0.0';

  listing_id: string;
  seller_id: string;

  title: string;
  description: string;

  /*
   * This is deliberately a string.
   * ReturnShield must not invent a fixed category list.
   */
  category: string;

  listing_risk: ListingRisk;
  status: ListingStatus;

  analysis: ListingGuardOutput;
  analysis_metadata: ListingAnalysisMetadata;

  created_at: string;
}

export interface ListingRequest {
  schema_version: '1.0.0';

  listing_id: string;
  seller_id: string;

  title: string;
  description: string;

  /*
   * The connected marketplace provides this value.
   */
  category: string;
}

export interface ReturnRequest {
  schema_version: '1.0.0';

  order_id: string;
  reason: ReturnReason;
  evidence: Evidence[];
}

export interface Seller {
  schema_version: '1.0.0';

  seller_id: string;

  trust_score: number;
  listing_flags: number;
  return_rate: number;
  dispute_count: number;

  cases: string[];
}

export interface CaseQuery {
  limit?: number;
  cursor?: string;

  status?: CaseStatus;
  priority?: Priority;
  decision?: CaseDecision;
  seller_id?: string;

  review_status?:
    | 'OPEN'
    | 'RESOLVED';
}

export interface DecisionRequest {
  schema_version: '1.0.0';

  expected_revision: number;

  action:
    | 'APPROVE_RETURN'
    | 'DECLINE_RETURN';

  note: string;
}

export interface ImageEvidence {
  image_id: string;

  subject_type:
    | 'LISTING'
    | 'RETURN_CASE';

  subject_id: string;

  status: string;
  content_type: string;

  size_bytes: number | null;
  width: number | null;
  height: number | null;

  analysis_status: string;

  analysis:
    | {
        summary?: string;
        recommendation?: string;
      }
    | null;

  created_at: string;
}

export interface Envelope<T> {
  schema_version: '1.0.0';
  correlation_id: string;
  data: T;
}

export type ListingResponse =
  Envelope<Listing>;

export type ReturnResponse =
  Envelope<{
    case: ReturnCase;
    replayed: boolean;
  }>;

export type CaseResponse =
  Envelope<ReturnCase>;

export type CasesResponse =
  Envelope<{
    items: ReturnCase[];
    next_cursor: string | null;
  }>;

export type SellerResponse =
  Envelope<Seller>;

export type DashboardResponse =
  Envelope<{
    as_of: string;

    flagged_listings: number;
    auto_approved_returns: number;

    normal_review_cases: number;
    high_review_cases: number;

    open_review_cases: number;
    missing_context_cases: number;
  }>;

export type DecisionResponse =
  Envelope<ReturnCase>;

export type ImageListResponse =
  Envelope<{
    items: ImageEvidence[];
  }>;

export type ImageDownloadResponse =
  Envelope<{
    download_url: string;
    expires_at: string;
  }>;
