import { useCallback, useEffect, useRef, useState } from 'react';

import type { HealthResponse } from '@returnshield/contracts';

import { ApiError, getHealth } from './client';

export type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; response: HealthResponse; checkedAt: Date }
  | { status: 'error'; error: ApiError; checkedAt: Date };

/**
 * Requests `GET /v1/health` through the shared client and exposes the three
 * states both routes must render: loading, success and failure.
 */
export function useHealth(): { state: HealthState; refresh: () => void } {
  const [state, setState] = useState<HealthState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setState({ status: 'loading' });

    getHealth({ signal: controller.signal })
      .then((response) => {
        if (mounted.current) setState({ status: 'ok', response, checkedAt: new Date() });
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError('network', 'The health check could not be completed.');
        setState({ status: 'error', error: apiError, checkedAt: new Date() });
      });

    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { state, refresh };
}
