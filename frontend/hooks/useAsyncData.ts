"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

export function useAsyncData<T>(loader: () => Promise<T>, dependencyKey = "default") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const load = useEffectEvent(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
    } catch (reason) {
      const nextError = reason instanceof Error ? reason : new Error("Unable to load data");
      setError(nextError);
    } finally {
      setLoading(false);
    }
  });

  const reload = useCallback(() => setRefreshToken((value) => value + 1), []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [dependencyKey, refreshToken]);

  return { data, setData, loading, error, reload };
}
