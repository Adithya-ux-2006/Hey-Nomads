import { useCallback, useEffect, useState } from 'react';

// One place for load/error/retry so pages stop swallowing failures.
// `fn` must return a promise. Pass an inline arrow with the deps you need.
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Guard against setting state after unmount or after a newer call supersedes us.
    let live = true;
    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(fn)
      .then(result => { if (live) setData(result); })
      .catch(err => { if (live) setError(err); })
      .finally(() => { if (live) setLoading(false); });

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  return { data, setData, loading, error, retry };
}