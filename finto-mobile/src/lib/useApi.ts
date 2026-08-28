import { useCallback, useEffect, useRef, useState } from 'react';
import { FintoApiError } from '@finto/api-client';
import { useLive } from './live';

interface State<T> {
  data: T | null;
  error: FintoApiError | null;
  loading: boolean;
}

/**
 * Fetch on mount and whenever the live connection reports a change.
 * Guards against out-of-order responses, so a slow first request cannot
 * overwrite a fast second one while someone types in a search field.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { live?: boolean } = {}
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
              : new FintoApiError(0, 'internal_error', 'Could not reach Finto.'),
          loading: false
        });
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, liveKey, manual]);

  return { ...state, reload };
}
