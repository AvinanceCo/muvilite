/**
 * Debounced value.
 *
 * Purpose: delay reacting to fast-changing input, so typing in the search box
 *          does not issue a request per keystroke.
 * Inputs:  a value and a delay in milliseconds
 * Outputs: the value, settled
 * Deps:    none
 */
import { useEffect, useState } from 'react';

export function useDebouncedValue(value, delay = 350) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export default useDebouncedValue;
