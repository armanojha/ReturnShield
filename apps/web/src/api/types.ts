export type CaseStatus = 'PROCESSING' | 'DECIDED' | 'ERROR_MISSING_CONTEXT' | 'FAILED';
export type Priority = 'NONE' | 'NORMAL' | 'HIGH';
export type ReviewStatus = 'NOT_APPLICABLE' | 'OPEN' | 'RESOLVED';
export interface RiskContribution {
  risk_event_id: string;
  signal: string;
  contribution: number | null;
  max: number | null;
  reason: string;
  evidence_refs: string[];
  source: string;
  timestamp: string;
}
export interface Evidence {
  evidence_id: string;
  kind: string;
  source_id: string;
  text: string;
  observed_at: string;
}
export interface TimelineEntry {
  event_id: string;
  timestamp: string;
  type: string;
  actor_id: string;
  message: string;
}
export interface ReturnCase {
  case_id: string;
  order_id: string;
  seller_id: string;
  listing_id: string;
  customer_id: string;
  reason: string;
  status: CaseStatus;
  revision: number;
  raw_contribution_total: number | null;
  risk_score: number | null;
  decision: 'AUTO_APPROVE' | 'NEEDS_REVIEW' | null;
  priority: Priority | null;
  contributions: RiskContribution[];
  evidence: Evidence[];
  review_status: ReviewStatus;
  reviewer_disposition: Record<string, unknown> | null;
  explanation_status: string;
  explanation: {
    summary?: string;
    factors?: Array<{ signal: string; explanation: string }>;
    recommended_action?: string;
  } | null;
  error: Record<string, unknown> | null;
  timeline: TimelineEntry[];
  created_at: string;
  updated_at: string;
}
export interface Listing {
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: 'APPAREL' | 'ELECTRONICS' | 'HOME';
  listing_risk: 'low' | 'medium' | 'high';
  status: 'PASS' | 'CORRECTION_REQUIRED';
  analysis: Record<string, unknown>;
  analysis_metadata: Record<string, unknown>;
  created_at: string;
}
export interface Seller {
  seller_id: string;
  trust_score: number;
  listing_flags: number;
  return_rate: number;
  dispute_count: number;
  cases: string[];
}
export interface ImageEvidence {
  image_id: string;
  subject_type: 'LISTING' | 'RETURN_CASE';
  subject_id: string;
  status: string;
  content_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  analysis_status: string;
  analysis: { summary?: string; recommendation?: string } | null;
  created_at: string;
}
export interface Envelope<T> {
  schema_version: '1.0.0';
  correlation_id: string;
  data: T;
}
export type ListingResponse = Envelope<Listing>;
export type CaseResponse = Envelope<ReturnCase>;
export type SellerResponse = Envelope<Seller>;
export type CasesResponse = Envelope<{ items: ReturnCase[]; next_cursor: string | null }>;
export type DashboardResponse = Envelope<{
  as_of: string;
  flagged_listings: number;
  auto_approved_returns: number;
  normal_review_cases: number;
  high_review_cases: number;
  open_review_cases: number;
  missing_context_cases: number;
}>;
export type DecisionResponse = CaseResponse;
export type ReturnResponse = Envelope<{ case: ReturnCase; replayed: boolean }>;
export type ImageListResponse = Envelope<{ items: ImageEvidence[] }>;
export type ImageDownloadResponse = Envelope<{ download_url: string; expires_at: string }>;
