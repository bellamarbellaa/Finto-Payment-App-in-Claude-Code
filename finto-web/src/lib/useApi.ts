import { useCallback, useEffect, useRef, useState } from 'react';
import { FintoApiError } from '@finto/api-client';
import { useLive } from './live';

interface State<T> {
  data: T | null;
  error: FintoApiError | null;
  loading: boolean;
}

/**
 * Fetch on mount, and again whenever the live connection reports that
 * something changed. `deps` behaves like a useEffect dependency list.
 *
 * The request is guarded against out-of-order responses: a slow first fetch
 * must not overwrite a fast second one, which is what happens when someone
 * types quickly into a search field.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { live?: boolean } = { live: true }
): State<T> & { reload: () => void } {
  const { revision } = useLive();
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [manual, setManual] = useState(0);
  const sequence = useRef(0);

  const reload = useCallback(() => setManual((n) => n + 1), []);

  const liveKey = options.live === false ? 0 : revision;

  useEffect(() => {
    const ticket = ++sequence.current;
    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true }));

    fetcher()
      .then((data) => {
        if (cancelled || ticket !== sequence.current) return;
        setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled || ticket !== sequence.current) return;
        setState({
          data: null,
          error:
            err instanceof FintoApiError
              ? err
              : new FintoApiError(0, 'internal_error', 'Could not reach the server.'),
          loading: false
        });
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, liveKey, manual]);

  return { ...state, reload };
}
