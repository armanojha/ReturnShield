import { useState, useEffect, useCallback } from "react";

// Generic data-fetching hook. No data renders until a real response
// (or a real error) comes back. There is no default or sample state.
//
// Usage: useApi(() => getCase(caseId), [caseId])
// fetchFn is called with no arguments, so wrap it if it needs any.
//
// On refetch, the previous data is kept while loading, so a screen does not
// blank out. Components should show a loading state only when
// `loading && !data`.
export function useApi(fetchFn, deps = []) {
 const [state, setState] = useState({ data: null, loading: true, error: null });
 const [tick, setTick] = useState(0);

 useEffect(() => {
 let cancelled = false;
 setState((s) => ({ ...s, loading: true, error: null }));

 fetchFn()
 .then((data) => {
 if (!cancelled) setState({ data, loading: false, error: null });
 })
 .catch((err) => {
 if (!cancelled) {
 setState({ data: null, loading: false, error: err.message });
 }
 });

 return () => {
 cancelled = true;
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [...deps, tick]);

 const refetch = useCallback(() => setTick((t) => t + 1), []);

 return { ...state, refetch };
}
