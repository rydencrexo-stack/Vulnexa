import type { ApiErrorShape } from "@/types/pan";
import { apiBaseUrl } from "@/lib/api-url";

const API_BASE_URL = apiBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, timeoutMs = 3_500): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: init.signal ?? controller.signal,
      cache: init.cache ?? "no-store",
    });

    if (!response.ok) {
      let payload: ApiErrorShape | undefined;
      try {
        payload = (await response.json()) as ApiErrorShape;
      } catch {
        payload = undefined;
      }
      throw new ApiError(payload?.error?.message ?? payload?.detail ?? payload?.message ?? `Request failed (${response.status})`, response.status, payload);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function unwrapItems<T>(value: T[] | { items: T[] }): T[] {
  return Array.isArray(value) ? value : value.items;
}

/**
 * CORS-safe request for public endpoints (e.g. /api/agent/scan).
 * Uses credentials: "omit" (no cookies) so a wildcard CORS origin is allowed,
 * and a longer timeout for real scanning work.
 */
export async function publicRequest<T>(path: string, init: RequestInit = {}, timeoutMs = 120_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      credentials: "omit",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: init.signal ?? controller.signal,
      cache: init.cache ?? "no-store",
    });

    if (!response.ok) {
      let payload: ApiErrorShape | undefined;
      try {
        payload = (await response.json()) as ApiErrorShape;
      } catch {
        payload = undefined;
      }
      throw new ApiError(payload?.error?.message ?? payload?.detail ?? payload?.message ?? `Request failed (${response.status})`, response.status, payload);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
