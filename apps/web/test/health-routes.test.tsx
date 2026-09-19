import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';

const healthBody = {
  schema_version: '1.0.0',
  correlation_id: 'test-cid',
  data: {
    service: 'returnshield',
    status: 'healthy',
    version: '0.0.0',
    uptime_seconds: 1,
  },
};

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

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('requests GET /v1/health through the shared client with a correlation id', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(healthBody));
    renderAt(path);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/health$/);
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['x-correlation-id']).toBeTruthy();
  });

  it('renders the success state when the service returns a valid envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(healthBody));
    renderAt(path);

    expect(await screen.findByText(/service healthy/i)).toBeInTheDocument();
  });

  it('renders the failure state when the request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    renderAt(path);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/API unavailable/i);
    expect(screen.queryByText(/service healthy/i)).not.toBeInTheDocument();
  });

  it('does not report healthy when the body fails frozen-schema validation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ schema_version: '1.0.0', data: { service: 'returnshield', status: 'ok' } }),
    );
    renderAt(path);

    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
  });

  it('does not report healthy when the service returns a structured error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          schema_version: '1.0.0',
          correlation_id: 'err-cid',
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

    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
  });
});

describe('routing', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(healthBody)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the marketplace workspace', async () => {
    renderAt('/marketplace');
    expect(await screen.findByRole('heading', { name: /seller listing workspace/i })).toBeVisible();
  });

  it('renders the operations center', async () => {
    renderAt('/ops');
    expect(await screen.findByRole('heading', { name: /trust operations center/i })).toBeVisible();
  });

  it('redirects the index route to the operations center', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /trust operations center/i })).toBeVisible();
  });

  it('exposes primary navigation to both routes', () => {
    renderAt('/ops');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(nav).toHaveTextContent('Marketplace');
    expect(nav).toHaveTextContent('Operations');
  });
});
