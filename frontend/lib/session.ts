import { cookies } from "next/headers";
import type { Role } from "@/types/pan";

export interface OptimisticSession {
  authenticated: boolean;
  role: Role;
}

export async function readSession(): Promise<OptimisticSession> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("pan_role")?.value;
  const role: Role = roleCookie === "admin" || roleCookie === "analyst" ? roleCookie : "user";
  const authenticated = Boolean(
    cookieStore.get("pan_session")?.value ||
      cookieStore.get("access_token")?.value ||
      cookieStore.get("access_token_cookie")?.value,
  );
  return { authenticated, role };
}
