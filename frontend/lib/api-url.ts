const LOOPBACK = new Set(["localhost", "127.0.0.1", ""]);

function configuredBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

/** Resolve the API base at runtime so phones/tablets on the LAN can reach the
 *  backend: when the page is served from a non-loopback host, the baked-in
 *  localhost URL is rewritten to that host (same port, same protocol). */
export function apiBaseUrl(): string {
  const env = configuredBase();
  if (typeof window === "undefined") return env;
  const host = window.location.hostname;
  const envHost = env.match(/^https?:\/\/([^/:]+)/)?.[1] ?? "";
  if (!LOOPBACK.has(host) && LOOPBACK.has(envHost)) {
    const port = env.match(/:(\d+)$/)?.[1] ?? "8000";
    return `${window.location.protocol}//${host}:${port}`;
  }
  return env;
}

export function wsBaseUrl(): string {
  return apiBaseUrl().replace(/^http/, "ws");
}