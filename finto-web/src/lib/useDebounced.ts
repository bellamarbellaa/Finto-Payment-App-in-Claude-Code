import { useEffect, useState } from 'react';

/**
 * Hold a value still for `delay` ms. Search fields fire a request per keystroke
 * without this, which is both wasteful and produces flickering results.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
