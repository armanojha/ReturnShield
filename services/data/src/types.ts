export type SchemaVersion = '1.0.0';
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface Evidence {
  schema_version: SchemaVersion;
  evidence_id: string;
  kind:
    | 'SELLER_HISTORY'
    | 'LISTING_CONTENT'
    | 'CUSTOMER_HISTORY'
    | 'ORDER_RECORD'
    | 'RETURN_STATEMENT'
    | 'CATEGORY_POLICY'
    | 'CONTEXT_FAILURE';
  source_id: string;
  text: string;
  observed_at: string;
}

export interface Seller {
  schema_version: SchemaVersion;
  seller_id: string;
  trust_score: number;
  listing_flags: number;
  return_rate: number;
  dispute_count: number;
  cases: string[];
}

export interface Listing {
  schema_version: SchemaVersion;
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: 'APPAREL' | 'ELECTRONICS' | 'HOME';
  listing_risk: 'low' | 'medium' | 'high';
  status: 'PASS' | 'CORRECTION_REQUIRED';
  analysis: JsonObject;
  analysis_metadata: JsonObject;
  created_at: string;
}

export interface Customer {
  schema_version: SchemaVersion;
  customer_id: string;
  return_count: number;
  recent_returns: number;
  account_age_days: number;
  case_history: string[];
}

export interface Order {
  schema_version: SchemaVersion;
  order_id: string;
  seller_id: string;
  customer_id: string;
  listing_id: string;
  timestamp: string;
  status: 'PLACED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  delivered_at: string | null;
}

export interface RiskEvent {
  schema_version: SchemaVersion;
  risk_event_id: string;
  case_id: string;
  signal: 'seller' | 'listing' | 'customer' | 'return' | 'category' | 'context';
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
  policy_version: SchemaVersion;
  timestamp: string;
}

export interface ReturnCase {
  schema_version: SchemaVersion;
  case_id: string;
  order_id: string;
  seller_id: string;
  listing_id: string;
  customer_id: string;
  reason: 'NOT_AS_DESCRIBED' | 'DAMAGED' | 'WRONG_ITEM' | 'NOT_RECEIVED' | 'CHANGED_MIND';
  evidence: Evidence[];
  status: 'PROCESSING' | 'DECIDED' | 'ERROR_MISSING_CONTEXT' | 'FAILED';
  revision: number;
  raw_contribution_total: number | null;
  risk_score: number | null;
  policy_version: SchemaVersion;
  decision: 'AUTO_APPROVE' | 'NEEDS_REVIEW' | null;
  priority: 'NONE' | 'NORMAL' | 'HIGH' | null;
  contributions: RiskEvent[];
  review_status: 'NOT_APPLICABLE' | 'OPEN' | 'RESOLVED';
  reviewer_disposition: JsonObject | null;
  explanation_status: 'NOT_REQUESTED' | 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE' | 'RETRY_PENDING';
  explanation: JsonObject | null;
  error: JsonObject | null;
  timeline: JsonObject[];
  created_at: string;
  updated_at: string;
}

export type Entity = Seller | Listing | Customer | Order | ReturnCase | RiskEvent;
export type EntityType = 'Seller' | 'Listing' | 'Customer' | 'Order' | 'ReturnCase' | 'RiskEvent';
