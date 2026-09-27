import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../api/client";
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    // Promise boundary also catches synchronous loader errors.
    Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setState({ loading: true });
        return load(controller.signal);
      })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ error: errorMessage(error), loading: false });
      });
    return () => controller.abort();
  }, [load, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
