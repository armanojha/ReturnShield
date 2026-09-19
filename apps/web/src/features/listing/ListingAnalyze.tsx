import type {
  FormEvent,
} from 'react';

import {
  useState,
} from 'react';

import {
  analyzeListing,
  ApiError,
} from '../../api/client';

import type {
  ListingAnalyzeRequest,
  ListingResponse,
} from '../../api/types';

import { StatusPill } from '../../components/StatusPill';

const INITIAL_FORM:
  ListingAnalyzeRequest = {
  schema_version: '1.0.0',
  listing_id: '',
  seller_id: '',
  title: '',
  description: '',
  category: 'APPAREL',
};

export function ListingAnalyze(): JSX.Element {
  const [
    form,
    setForm,
  ] = useState(INITIAL_FORM);

  const [
    result,
    setResult,
  ] = useState<ListingResponse | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState<ApiError | null>(
    null,
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  function update(
    field: keyof ListingAnalyzeRequest,
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response =
        await analyzeListing(
          form,
        );

      setResult(response);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError(
              'network',
              'Listing analysis failed.',
            ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="eyebrow">
        ListingGuard
      </div>

      <h2>
        Analyze a listing
      </h2>

      <p className="muted">
        Submit real listing data to
        the ReturnShield listing
        analysis endpoint.
      </p>

      <form
        className="form-grid"
        onSubmit={submit}
      >
        <label>
          Listing ID

          <input
            required
            value={form.listing_id}
            onChange={(event) =>
              update(
                'listing_id',
                event.target.value,
              )
            }
          />
        </label>

        <label>
          Seller ID

          <input
            required
            value={form.seller_id}
            onChange={(event) =>
              update(
                'seller_id',
                event.target.value,
              )
            }
          />
        </label>

        <label className="form-grid__full">
          Title

          <input
            required
            maxLength={4000}
            value={form.title}
            onChange={(event) =>
              update(
                'title',
                event.target.value,
              )
            }
          />
        </label>

        <label className="form-grid__full">
          Description

          <textarea
            required
            rows={7}
            maxLength={4000}
            value={form.description}
            onChange={(event) =>
              update(
                'description',
                event.target.value,
              )
            }
          />
        </label>

        <label>
          Category

          <select
            value={form.category}
            onChange={(event) =>
              update(
                'category',
                event.target.value,
              )
            }
          >
            <option value="APPAREL">
              APPAREL
            </option>

            <option value="ELECTRONICS">
              ELECTRONICS
            </option>

            <option value="HOME">
              HOME
            </option>
          </select>
        </label>

        <div className="form-actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Analyzing…'
              : 'Analyze listing'}
          </button>
        </div>
      </form>

      {error && (
        <div
          className="inline-error"
          role="alert"
        >
          {error.message}
        </div>
      )}

      {result && (
        <div className="analysis-result">
          <div className="analysis-result-header">
            <div>
              <div className="eyebrow">
                Result
              </div>

              <h3>
                {result.data.title ??
                  result.data.listing_id}
              </h3>
            </div>

            <StatusPill
              value={
                result.data.status
              }
            />
          </div>

          <div className="detail-grid">
            <div className="detail-field">
              <div className="detail-label">
                Listing risk
              </div>

              <div className="detail-value">
                <StatusPill
                  value={
                    result.data
                      .listing_risk
                  }
                />
              </div>
            </div>

            <div className="detail-field">
              <div className="detail-label">
                Correlation ID
              </div>

              <div className="detail-value">
                {result.correlation_id ??
                  '—'}
              </div>
            </div>
          </div>

          {result.data.analysis && (
            <div className="analysis-box">
              <pre>
                {JSON.stringify(
                  result.data.analysis,
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
