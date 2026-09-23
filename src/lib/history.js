import { useState, useCallback, useRef } from 'react';

const LIMIT = 60;

/**
 * Undo/redo for the template.
 *
 * Drags fire dozens of updates a second, so every change carries a `label`.
 * Consecutive changes with the same label inside a short window collapse into
 * one history entry — otherwise a single drag would eat the whole undo stack
 * and Ctrl+Z would move the element one pixel at a time.
 */
export function useHistory(initial) {
  const [state, setState] = useState(initial);
  const past = useRef([]);
  const future = useRef([]);
  const lastCommit = useRef({ label: null, at: 0 });
  const [version, setVersion] = useState(0);

  const bump = () => setVersion((v) => v + 1);

  const commit = useCallback((updater, label = 'edit', coalesceMs = 600) => {
    setState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next === current) return current;

      const now = Date.now();
      const sameAction =
        label !== null &&
        lastCommit.current.label === label &&
        now - lastCommit.current.at < coalesceMs;

      if (!sameAction) {
        past.current.push(current);
        if (past.current.length > LIMIT) past.current.shift();
        future.current = [];
      }

      lastCommit.current = { label, at: now };
      bump();
      return next;
    });
  }, []);

  /** Replace without touching history — loading a template, for instance. */
  const reset = useCallback((value) => {
    past.current = [];
    future.current = [];
    lastCommit.current = { label: null, at: 0 };
    setState(value);
    bump();
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      if (!past.current.length) return current;
      const prev = past.current.pop();
      future.current.push(current);
      lastCommit.current = { label: null, at: 0 };
      bump();
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      if (!future.current.length) return current;
      const next = future.current.pop();
      past.current.push(current);
      lastCommit.current = { label: null, at: 0 };
      bump();
      return next;
    });
  }, []);

  return {
    state,
    commit,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    version
  };
}
