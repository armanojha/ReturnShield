import { ComingInPhase, Page } from '../components/Page';

/**
 * `/marketplace` — the mock seller-facing surface.
 *
 * Phase 01 delivers the shell and a live health check only. Listing submission
 * and ListingGuard results belong to Phase 03.
 */
export function MarketplaceRoute(): JSX.Element {
  return (
    <Page
      eyebrow="Marketplace"
      title="Seller listing workspace"
      lede="The demonstration storefront that submits listings to ListingGuard and raises returns against synthetic orders."
    >
      <ComingInPhase
        phase="Phase 03"
        summary="Listing submission, validated ListingGuard results and correction guidance."
      />
      <ComingInPhase
        phase="Phase 05"
        summary="Return intake against an existing synthetic order, with the case status it produces."
      />
    </Page>
  );
}

export default MarketplaceRoute;
