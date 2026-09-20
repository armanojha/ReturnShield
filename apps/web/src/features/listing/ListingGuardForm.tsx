import { useState } from 'react';
import type { FormEvent } from 'react';

import {
  analyzeListing,
  ApiError,
} from '../../api/client';

import type {
  ListingResponse,
} from '../../api/types';

interface ListingForm {
  listing_id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
}

const INITIAL_FORM: ListingForm = {
  listing_id: '',
  seller_id: '',
  title: '',
  description: '',
  category: '',
};

function isBlank(
  value: string,
): boolean {
  return value.trim().length === 0;
}

function formatRisk(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Unavailable';
  }

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

export function ListingGuardForm(): JSX.Element {
  const [form, setForm] =
    useState<ListingForm>(
      INITIAL_FORM,
    );

  const [result, setResult] =
    useState<ListingResponse | null>(
      null,
    );

  const [error, setError] =
    useState<ApiError | string | null>(
      null,
    );

  const [busy, setBusy] =
    useState(false);

  function update(
    field: keyof ListingForm,
    value: string,
  ): void {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    /*
     * Once the seller edits the listing after a correction result,
     * the previous analysis is no longer the current listing state.
     */
    if (result) {
      setResult(null);
    }

    if (error) {
      setError(null);
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const listingId =
      form.listing_id.trim();

    const sellerId =
      form.seller_id.trim();

    const title =
      form.title.trim();

    const description =
      form.description.trim();

    const category =
      form.category.trim();

    if (
      isBlank(listingId) ||
      isBlank(sellerId) ||
      isBlank(title) ||
      isBlank(description) ||
      isBlank(category)
    ) {
      setError(
        'Please complete all listing fields before submitting.',
      );
      setResult(null);
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      /*
       * Every submission gets its own idempotency key.
       * A corrected listing submitted again therefore represents
       * a new analysis request.
       */
      const response =
        await analyzeListing(
          {
            schema_version: '1.0.0',
            listing_id: listingId,
            seller_id: sellerId,
            title,
            description,
            category,
          },
          crypto.randomUUID(),
        );

      setResult(response);
    } catch (cause) {
      if (
        cause instanceof ApiError
      ) {
        setError(cause);
      } else if (
        cause instanceof Error
      ) {
        setError(cause.message);
      } else {
        setError(
          'The listing could not be analyzed.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function clearAnalysis(): void {
    setResult(null);
    setError(null);
  }

  return (
    <section
      className="panel"
      aria-labelledby="listingguard-title"
    >
      <div className="panel__header">
        <div>
          <p className="page__eyebrow">
            Seller
          </p>

          <h2
            id="listingguard-title"
            className="panel__title"
          >
            ListingGuard
          </h2>

          <p className="panel__body">
            Submit a listing for analysis before the
            connected e-commerce platform publishes it.
          </p>
        </div>
      </div>

      <form
        className="listing-form"
        onSubmit={submit}
        noValidate
      >
        <div className="listing-form__grid">
          <label>
            Listing ID

            <input
              required
              name="listing_id"
              value={
                form.listing_id
              }
              onChange={(event) =>
                update(
                  'listing_id',
                  event.target.value,
                )
              }
              placeholder="Marketplace listing ID"
              autoComplete="off"
              disabled={busy}
            />
          </label>

          <label>
            Seller ID

            <input
              required
              name="seller_id"
              value={
                form.seller_id
              }
              onChange={(event) =>
                update(
                  'seller_id',
                  event.target.value,
                )
              }
              placeholder="Marketplace seller ID"
              autoComplete="off"
              disabled={busy}
            />
          </label>
        </div>

        <label>
          Listing title

          <input
            required
            name="title"
            maxLength={4000}
            value={
              form.title
            }
            onChange={(event) =>
              update(
                'title',
                event.target.value,
              )
            }
            placeholder="Enter the actual listing title"
            disabled={busy}
          />
        </label>

        <label>
          Description

          <textarea
            required
            name="description"
            maxLength={4000}
            rows={7}
            value={
              form.description
            }
            onChange={(event) =>
              update(
                'description',
                event.target.value,
              )
            }
            placeholder="Enter the actual product description"
            disabled={busy}
          />
        </label>

        <label>
          Category

          <input
            required
            name="category"
            value={
              form.category
            }
            onChange={(event) =>
              update(
                'category',
                event.target.value,
              )
            }
            placeholder="Category provided by the marketplace"
            disabled={busy}
          />

          <span className="panel__meta">
            ReturnShield does not maintain a
            frontend-defined category list.
          </span>
        </label>

        <div className="listing-form__actions">
          <button
            type="submit"
            className="button-primary"
            disabled={busy}
          >
            {busy
              ? 'Analyzing…'
              : 'Analyze listing'}
          </button>

          {result && (
            <button
              type="button"
              className="button-secondary"
              onClick={
                clearAnalysis
              }
              disabled={busy}
            >
              Edit listing
            </button>
          )}
        </div>
      </form>

      {error && (
        <div
          className="listing-result listing-result--error"
          role="alert"
          style={{
            marginTop:
              'var(--space-4)',
            padding:
              'var(--space-4)',
            borderRadius:
              'var(--radius)',
          }}
        >
          <h3>
            Listing analysis failed
          </h3>

          <p>
            {error instanceof ApiError
              ? error.message
              : error}
          </p>

          {error instanceof ApiError &&
            error.correlationId && (
              <p className="panel__meta">
                Correlation ID:{' '}
                {
                  error.correlationId
                }
              </p>
            )}
        </div>
      )}

      {result && (
        <ListingAnalysisResult
          response={result}
        />
      )}
    </section>
  );
}

function ListingAnalysisResult({
  response,
}: {
  response: ListingResponse;
}): JSX.Element {
  const {
    data,
  } = response;

  const passed =
    data.status === 'PASS';

  const issues =
    data.analysis.issues ??
    [];

  const evidence =
    data.analysis.evidence ??
    [];

  const recommendation =
    data.analysis
      .recommended_action;

  return (
    <section
      className={`listing-result ${
        passed
          ? 'listing-result--pass'
          : 'listing-result--review'
      }`}
      aria-live="polite"
    >
      <div className="listing-result__header">
        <div>
          <p className="page__eyebrow">
            ListingGuard result
          </p>

          <h3>
            {passed
              ? 'Listing approved'
              : 'Listing needs correction'}
          </h3>
        </div>

        <span className="listing-result__status">
          {data.status}
        </span>
      </div>

      <p>
        Risk:{' '}
        <strong>
          {formatRisk(
            data.listing_risk,
          )}
        </strong>
      </p>

      {passed ? (
        <p>
          Your listing passed ListingGuard and can be
          published by the connected e-commerce platform.
        </p>
      ) : (
        <>
          <h4>
            Problems found
          </h4>

          {issues.length > 0 ? (
            <ul>
              {issues.map(
                (issue) => (
                  <li
                    key={
                      issue.issue_id
                    }
                  >
                    {
                      issue.description
                    }
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p>
              ListingGuard requested a correction, but
              no issue details were returned.
            </p>
          )}

          <p>
            Please update the listing and submit it again.
          </p>
        </>
      )}

      {evidence.length > 0 && (
        <div className="listing-result__evidence">
          <h4>
            Evidence from the listing
          </h4>

          <ul>
            {evidence.map(
              (item) => (
                <li
                  key={
                    item.evidence_id
                  }
                >
                  <strong>
                    {formatRisk(
                      item.field,
                    )}
                    :
                  </strong>{' '}
                  “
                  {
                    item.quote
                  }
                  ”
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {recommendation && (
        <p>
          Recommended action:{' '}
          <strong>
            {recommendation}
          </strong>
        </p>
      )}

      <div
        style={{
          marginTop:
            'var(--space-3)',
        }}
      >
        <p className="panel__meta">
          Listing ID:{' '}
          {data.listing_id}
        </p>

        <p className="panel__meta">
          Seller ID:{' '}
          {data.seller_id}
        </p>

        <p className="panel__meta">
          Correlation ID:{' '}
          {response.correlation_id}
        </p>
      </div>
    </section>
  );
}

export default ListingGuardForm;
