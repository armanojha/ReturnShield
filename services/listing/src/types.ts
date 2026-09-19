import type { ListingGuardOutput } from './ai/validator.js';

export type ListingCategory = 'APPAREL' | 'ELECTRONICS' | 'HOME';

export interface ListingInput {
  schema_version: '1.0.0';
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: ListingCategory;
}

export interface ListingAnalysisMetadata {
  model_id: string;
  prompt_version: string;
  schema_version: '1.0.0';
  validation_result: 'VALID';
  correlation_id: string;
}

export interface ListingAnalysisResult {
  listing: {
    schema_version: '1.0.0';
    listing_id: string;
    seller_id: string;
    title: string;
    description: string;
    category: ListingCategory;
    listing_risk: ListingGuardOutput['severity'];
    status: ListingGuardOutput['status'];
    analysis: ListingGuardOutput;
    analysis_metadata: ListingAnalysisMetadata;
    created_at: string;
  };
}
