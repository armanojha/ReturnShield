import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { healthEnvelope, newCorrelationId } from '@returnshield/contracts';

import { App } from '../src/App';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const ROUTES = ['/marketplace', '/ops'] as const;

describe.each(ROUTES)('%s health indicator', (path) => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the loading state before the request settles', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    renderAt(path);

    expect(screen.getByText(/checking service health/i)).toBeInTheDocument();
  });

  it('requests GET /v1/health through the shared client with a correlation id', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(healthEnvelope(newCorrelationId())));
    renderAt(path);

    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/v1/health'))).toBe(
        true,
      ),
    );

    const [url, init] = vi
      .mocked(fetch)
      .mock.calls.find(([value]) => String(value).endsWith('/v1/health')) as [string, RequestInit];
    expect(url).toMatch(/\/v1\/health$/);
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['x-correlation-id']).toBeTruthy();
  });

  it('renders the success state when the service returns a valid envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(healthEnvelope(newCorrelationId())));
    renderAt(path);

    expect(await screen.findByText(/service healthy/i)).toBeInTheDocument();
  });

  it('renders the failure state when the request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt(path);

    expect(await screen.findByText(/service health unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/service healthy/i)).not.toBeInTheDocument();
  });

  it('does not report healthy when the body fails frozen-schema validation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ schema_version: '1.0.0', data: { service: 'returnshield', status: 'ok' } }),
    );
    renderAt(path);

    expect(await screen.findByText(/service health unavailable/i)).toBeInTheDocument();
  });

  it('does not report healthy when the service returns a structured error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          schema_version: '1.0.0',
          correlation_id: newCorrelationId(),
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Health check could not be completed.',
            retryable: true,
            details: [],
          },
        },
        500,
      ),
    );
    renderAt(path);

    expect(await screen.findByText(/service health unavailable/i)).toBeInTheDocument();
  });
});

describe('routing', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(healthEnvelope(newCorrelationId()))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the marketplace workspace', async () => {
    renderAt('/marketplace');
    expect(
      await screen.findByRole('heading', {
        name: /seller and customer workflows|seller listing workspace/i,
      }),
    ).toBeVisible();
  });

  it('renders the operations center', async () => {
    renderAt('/ops');
    expect(
      await screen.findByRole('heading', {
        name: /returnshield operations|trust command center/i,
      }),
    ).toBeVisible();
  });

  it('redirects the index route to the marketplace', async () => {
    renderAt('/');
    expect(
      await screen.findByRole('heading', {
        name: /seller and customer workflows|seller listing workspace/i,
      }),
    ).toBeVisible();
  });

  it('exposes primary navigation to both routes', () => {
    renderAt('/ops');
    const nav = screen.getByRole('navigation', { name: /^operations$/i });
    expect(nav).toHaveTextContent(/overview/i);
  });
});
