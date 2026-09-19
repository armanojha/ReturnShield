import { useState } from 'react';

import { analyzeListing, ApiError, type ListingResponse } from '../../api/client';

const INITIAL = {
  listing_id: '',
  seller_id: '',
  title: '',
  description: '',
  category: 'APPAREL' as const,
};

export function ListingGuardForm(): JSX.Element {
  const [form, setForm] = useState(INITIAL);
  const [result, setResult] = useState<ListingResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await analyzeListing({ schema_version: '1.0.0', ...form }));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError('network', 'The listing could not be analyzed.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="listingguard-title">
      <h2 id="listingguard-title" className="panel__title">
        ListingGuard analysis
      </h2>
      <p className="panel__body">Submit a listing for a validated policy-quality review.</p>
      <form className="listing-form" onSubmit={submit}>
        <label>
          Listing ID
          <input
            required
            value={form.listing_id}
            onChange={(e) => update('listing_id', e.target.value)}
          />
        </label>
        <label>
          Seller ID
          <input
            required
            value={form.seller_id}
            onChange={(e) => update('seller_id', e.target.value)}
          />
        </label>
        <label>
          Title
          <input
            required
            maxLength={4000}
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            required
            maxLength={4000}
            rows={5}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>
        <label>
          Category
          <select value={form.category} onChange={(e) => update('category', e.target.value)}>
            <option>APPAREL</option>
            <option>ELECTRONICS</option>
            <option>HOME</option>
          </select>
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Analyzing…' : 'Analyze listing'}
        </button>
      </form>
      {error && (
        <p className="listing-result listing-result--error" role="alert">
          {error.message}
        </p>
      )}
      {result && <ListingResult response={result} />}
    </section>
  );
}

function ListingResult({ response }: { response: ListingResponse }): JSX.Element {
  const { data } = response;
  return (
    <div className={`listing-result listing-result--${data.status === 'PASS' ? 'pass' : 'review'}`}>
      <h3>{data.status === 'PASS' ? 'Listing passed' : 'Correction required'}</h3>
      <p>
        Severity: <strong>{data.listing_risk}</strong>
      </p>
      <p>{String(data.analysis.recommended_action ?? '')}</p>
      {Array.isArray(data.analysis.evidence) && data.analysis.evidence.length > 0 && (
        <>
          <h4>Evidence</h4>
          <ul>
            {data.analysis.evidence.map((item) => (
              <li key={String(item.evidence_id)}>
                {String(item.field)}: “{String(item.quote)}”
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="panel__meta">Correlation ID: {response.correlation_id}</p>
    </div>
  );
}
