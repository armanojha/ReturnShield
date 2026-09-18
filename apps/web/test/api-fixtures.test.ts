import { assertValid } from '@returnshield/contracts';
import { describe, expect, it } from 'vitest';
import {
  caseDetailFixtures,
  caseListFixture,
  dashboardFixture,
  errorFixtures,
  healthFixture,
  listingFixtures,
  returnFixtures,
  reviewerDecisionFixture,
  sellerFixtures,
} from '../src/fixtures/api.js';

describe('versioned API fixtures', () => {
  it('all satisfy their frozen response definitions', () => {
    expect(() => assertValid('HealthResponse', healthFixture)).not.toThrow();
    listingFixtures.forEach((value) =>
      expect(() => assertValid('ListingResponse', value)).not.toThrow(),
    );
    returnFixtures.forEach((value) =>
      expect(() => assertValid('ReturnResponse', value)).not.toThrow(),
    );
    caseDetailFixtures.forEach((value) =>
      expect(() => assertValid('CaseResponse', value)).not.toThrow(),
    );
    sellerFixtures.forEach((value) =>
      expect(() => assertValid('SellerResponse', value)).not.toThrow(),
    );
    expect(() => assertValid('CasesResponse', caseListFixture)).not.toThrow();
    expect(() => assertValid('DashboardResponse', dashboardFixture)).not.toThrow();
    expect(() => assertValid('DecisionResponse', reviewerDecisionFixture)).not.toThrow();
    Object.values(errorFixtures).forEach((value) =>
      expect(() => assertValid('Error', value)).not.toThrow(),
    );
  });
});
