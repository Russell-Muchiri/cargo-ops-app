import { useEffect, useRef, useState, useCallback } from "react";

export function usePolling(fetcher, intervalMs = 10000, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const timerRef = useRef(null);

  const load = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) setLoading(true);
        const result = await fetcher();
        if (mounted.current) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (mounted.current) setError(e);
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    mounted.current = true;
    load(true);
    timerRef.current = setInterval(() => load(false), intervalMs);
    return () => {
      mounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refresh: () => load(false) };
}
