import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { ApiError } from './client';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  dependencies: unknown[] = [],
) {
  const [
    state,
    setState,
  ] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const [
    refreshToken,
    setRefreshToken,
  ] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken(
      (current) => current + 1,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    fetcher()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setState({
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(
                'network',
                'The request failed.',
              );

        setState({
          data: null,
          loading: false,
          error: apiError,
        });
      });

    return () => {
      cancelled = true;
    };

    // fetcher is intentionally controlled
    // by dependencies + refreshToken.
  }, [
    ...dependencies,
    refreshToken,
  ]);

  return {
    ...state,
    refresh,
  };
}
