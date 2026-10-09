export type LatestRequestState<Result> =
  | { key: string; status: "pending" }
  | { key: string; status: "success"; value: Result }
  | { key: string; status: "error"; error: unknown };

// Abort saves unnecessary work; the sequence also protects against transports
// that resolve after abort. Each controller belongs to one mounted form.
export function createLatestRequest<Input, Result>(
  request: (input: Input, signal: AbortSignal) => Promise<Result>,
  publish: (state: LatestRequestState<Result>) => void,
  debounceMs = 350,
) {
  let sequence = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let active: AbortController | undefined;
  let disposed = false;
  function cancel() {
    sequence++;
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
    active?.abort();
    active = undefined;
  }
  return {
    start(key: string, input: Input) {
      if (disposed) return;
      cancel();
      const current = sequence;
      const abort = new AbortController();
      active = abort;
      publish({ key, status: "pending" });
      timeout = setTimeout(async () => {
        timeout = undefined;
        try {
          const value = await request(input, abort.signal);
          if (!disposed && current === sequence && !abort.signal.aborted)
            publish({ key, status: "success", value });
        } catch (error) {
          if (!disposed && current === sequence && !abort.signal.aborted)
            publish({ key, status: "error", error });
        }
      }, debounceMs);
    },
    cancel,
    dispose() { disposed = true; cancel(); },
  };
}
