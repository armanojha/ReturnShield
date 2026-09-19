/**
 * Typed inputs, outputs and policy configuration for the deterministic trust engine.
 * Pure types plus closed enum lists mirrored from the frozen Phase 00 contracts.
 */

export type SchemaVersion = '1.0.0';
export type PolicyVersion = '1.0.0';

export const RISK_SIGNALS = ['seller', 'listing', 'customer', 'return', 'category'] as const;
export type RiskSignal = (typeof RISK_SIGNALS)[number];

export const LISTING_STATUSES = ['PASS', 'CORRECTION_REQUIRED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_CATEGORIES = ['APPAREL', 'ELECTRONICS', 'HOME'] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const RETURN_REASONS = [
  'NOT_AS_DESCRIBED',
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_RECEIVED',
  'CHANGED_MIND',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const ORDER_STATUSES = ['PLACED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type EvidenceKind =
  | 'SELLER_HISTORY'
  | 'LISTING_CONTENT'
  | 'CUSTOMER_HISTORY'
  | 'ORDER_RECORD'
  | 'RETURN_STATEMENT'
  | 'CATEGORY_POLICY'
  | 'CONTEXT_FAILURE';

export type RiskDecision = 'AUTO_APPROVE' | 'NEEDS_REVIEW';
export type RiskPriority = 'NONE' | 'NORMAL' | 'HIGH';

// ---------------------------------------------------------------------------
// Inputs. Every scoring field is optional/nullable so that absent context is
// detectable and reported as ERROR_MISSING_CONTEXT instead of defaulting to 0.
// Full contract entities are structurally assignable to these context shapes.
// ---------------------------------------------------------------------------

export interface SellerContext {
  readonly return_rate?: number | null;
  readonly dispute_count?: number | null;
}

export interface ListingContext {
  /** Validated ListingGuard status. This is the only listing field the score reads. */
  readonly status?: ListingStatus | null;
  readonly category?: ListingCategory | null;
  /** AI-derived advisory data. Carried for callers; never read by scoring. */
  readonly listing_risk?: unknown;
  /** AI-derived advisory data. Carried for callers; never read by scoring. */
  readonly analysis?: unknown;
}

export interface CustomerContext {
  readonly recent_returns?: number | null;
}

export interface OrderContext {
  readonly status?: OrderStatus | null;
}

export interface RequestContext {
  readonly reason?: ReturnReason | null;
}

export interface EvidenceRecord {
  readonly evidence_id: string;
  readonly kind: EvidenceKind;
}

export interface RiskEvaluationInput {
  /** True only when seller and customer history windows are fully loaded. */
  readonly history_complete?: boolean | null;
  readonly seller?: SellerContext | null;
  readonly listing?: ListingContext | null;
  readonly customer?: CustomerContext | null;
  readonly order?: OrderContext | null;
  readonly request?: RequestContext | null;
  /** Evidence attached to the case; contributions may cite only these ids. */
  readonly evidence?: readonly EvidenceRecord[] | null;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface RiskContribution {
  schema_version: SchemaVersion;
  signal: RiskSignal;
  points: number;
  max: number;
  reason: string;
  evidence_refs: string[];
}

/** Contract `Result` shape (contracts/risk/evaluation.schema.json). */
export interface ContractRiskResult {
  schema_version: SchemaVersion;
  policy_version: PolicyVersion;
  raw_contribution_total: number;
  score: number;
  decision: RiskDecision;
  priority: RiskPriority;
  contributions: RiskContribution[];
}

/** Contract result plus the de-duplicated evidence ids cited by all contributions. */
export interface RiskEvaluation extends ContractRiskResult {
  evidence_refs: string[];
}

/** Contract `MissingContext` shape. */
export interface MissingContextResult {
  schema_version: SchemaVersion;
  policy_version: PolicyVersion;
  code: 'ERROR_MISSING_CONTEXT';
  missing_fields: string[];
}

export type RiskEvaluationOutcome = RiskEvaluation | MissingContextResult;

export type SignalEvaluation =
  | { readonly status: 'OK'; readonly contribution: RiskContribution }
  | { readonly status: 'MISSING_CONTEXT'; readonly missing_fields: string[] };

export type SignalEvaluator = (
  input: RiskEvaluationInput,
  policy?: RiskPolicyConfig,
) => SignalEvaluation;

// ---------------------------------------------------------------------------
// Policy configuration
// ---------------------------------------------------------------------------

export interface ScoreBand {
  readonly min: number;
  readonly max: number;
  readonly decision: RiskDecision;
  readonly priority: RiskPriority;
}

export interface RiskPolicyConfig {
  readonly schema_version: SchemaVersion;
  readonly policy_version: PolicyVersion;
  readonly score_range: { readonly min: number; readonly max: number };
  readonly signals: {
    readonly seller: {
      readonly max: number;
      readonly window_days: number;
      readonly return_rate_at_or_above: number;
      readonly dispute_count_at_or_above: number;
      readonly rule: string;
    };
    readonly listing: {
      readonly max: number;
      readonly flagged_status: ListingStatus;
      readonly rule: string;
    };
    readonly customer: {
      readonly max: number;
      readonly window_days: number;
      readonly recent_returns_at_or_above: number;
      readonly rule: string;
    };
    readonly return: {
      readonly max: number;
      readonly reason: ReturnReason;
      readonly order_status: OrderStatus;
      readonly rule: string;
    };
    readonly category: {
      readonly max: number;
      readonly flagged_category: ListingCategory;
      readonly rule: string;
    };
  };
  readonly bands: readonly ScoreBand[];
}
