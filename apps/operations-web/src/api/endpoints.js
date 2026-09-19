import { get, post } from "./client";

// Matches Section 9's API contract.
export function getDashboardSummary() {
 return get("/dashboard/summary");
}

export function getCases() {
 return get("/cases");
}

export function getCase(caseId) {
 return get(`/cases/${encodeURIComponent(caseId)}`);
}

export function postCaseDecision(caseId, decision) {
 return post(`/cases/${encodeURIComponent(caseId)}/decision`, { decision });
}

export function getListing(listingId) {
 return get(`/listings/${encodeURIComponent(listingId)}`);
}

export function getSeller(sellerId) {
 return get(`/sellers/${encodeURIComponent(sellerId)}`);
}

// NOT in Section 9's contract yet. Needed so Listing review has something
// to list. The backend must add GET /listings.
export function getListings() {
 return get("/listings");
}
