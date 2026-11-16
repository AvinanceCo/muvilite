/**
 * Debounced value.
 *
 * Purpose: delay reacting to a fast-changing value — a filter box typed into
 *          character by character — so one request is sent instead of ten.
 * Inputs:  a value and a delay
 * Outputs: the value, settled
 * Deps:    react
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
