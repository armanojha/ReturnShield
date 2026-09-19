export type CaseDecision =
  | 'AUTO_APPROVE'
  | 'NEEDS_REVIEW';

export type ReviewerDecision =
  | 'APPROVE_RETURN'
  | 'DECLINE_RETURN';

export type ListingRisk =
  | 'low'
  | 'medium'
  | 'high';

export type ListingStatus =
  | 'PASS'
  | 'CORRECTION_REQUIRED';

export interface ApiEnvelope<T> {
  schema_version?: string;
  correlation_id?: string;
  data: T;
}

export interface ApiErrorBody {
  schema_version?: string;
  correlation_id?: string;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
}

export interface Signal {
  signal: string;
  contribution: number;
  source?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface EvidenceItem {
  evidence_id?: string;
  field?: string;
  quote?: string;
  source?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface TimelineEvent {
  event_type?: string;
  timestamp?: string;
  description?: string;
  source?: string;
  [key: string]: unknown;
}

export interface CaseSummary {
  case_id: string;
  seller_id?: string;
  listing_id?: string;
  order_id?: string;
  risk_score?: number;
  decision?: CaseDecision | string;
  reason?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ReturnCase extends CaseSummary {
  evidence?: EvidenceItem[];
  signals?: Signal[];
  risk_contributions?: Signal[];
  timeline?: TimelineEvent[];
  explanation?: string | Record<string, unknown> | null;
  ai_explanation?: string | Record<string, unknown> | null;
  reviewer_disposition?: string | null;
  explanation_status?: string | null;
}

export interface Listing {
  listing_id: string;
  seller_id?: string;
  title?: string;
  description?: string;
  category?: string;
  listing_risk?: ListingRisk | string;
  status?: ListingStatus | string;
  analysis?: Record<string, unknown>;
  analysis_metadata?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

export interface Seller {
  seller_id: string;
  [key: string]: unknown;
}

export interface DashboardSummary {
  [key: string]: unknown;
}

export interface ListingAnalyzeRequest {
  schema_version: '1.0.0';
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: 'APPAREL' | 'ELECTRONICS' | 'HOME';
}

export interface ListingResponse {
  schema_version?: string;
  correlation_id?: string;
  data: Listing;
}

export interface CaseListResponse {
  schema_version?: string;
  correlation_id?: string;
  data: CaseSummary[];
}

export interface CaseResponse {
  schema_version?: string;
  correlation_id?: string;
  data: ReturnCase;
}

export interface SellerResponse {
  schema_version?: string;
  correlation_id?: string;
  data: Seller;
}

export interface DashboardResponse {
  schema_version?: string;
  correlation_id?: string;
  data: DashboardSummary;
}

export interface HealthResponse {
  schema_version?: string;
  correlation_id?: string;
  data: {
    service: string;
    status?: string;
    [key: string]: unknown;
  };
}
