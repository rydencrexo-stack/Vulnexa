"use server";

import { cookies } from "next/headers";
import type { ActionResult, Role, User } from "@/types/pan";

const backendUrl = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 12,
};

function roleForEmail(email: string): Role {
  if (email.toLowerCase().startsWith("admin")) return "admin";
  if (email.toLowerCase().startsWith("user")) return "user";
  return "analyst";
}

type BackendUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId?: string | null;
};

function normalizeBackendUser(user: BackendUser): User {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    organization: user.organizationId ? "Authorized Demo Lab" : "Personal workspace",
  };
}

async function backendError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as {
    detail?: string;
    error?: { message?: string };
  };
  return payload.error?.message ?? payload.detail ?? fallback;
}

async function establishOptimisticSession(user: Pick<User, "id" | "role">, offline = false) {
  const cookieStore = await cookies();
  if (offline) cookieStore.set("pan_session", `${user.id}.${crypto.randomUUID()}`, cookieOptions);
  cookieStore.set("pan_role", user.role, cookieOptions);
}

async function forwardBackendSession(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() ?? (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  const cookieStore = await cookies();
  for (const raw of setCookies) {
    const firstPart = raw.split(";", 1)[0];
    const separator = firstPart.indexOf("=");
    if (separator < 1) continue;
    const name = firstPart.slice(0, separator).trim();
    const value = firstPart.slice(separator + 1).trim();
    if (name && value) cookieStore.set(name, value, cookieOptions);
  }
}

export async function loginAction(input: { email: string; password: string }): Promise<ActionResult<User>> {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." } };
  if (input.password.length < 8) return { ok: false, message: "Password must be at least 8 characters.", fieldErrors: { password: "Use at least 8 characters." } };

  try {
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password: input.password }),
      signal: AbortSignal.timeout(3_500),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await backendError(response, "Email or password is incorrect.") };
    }
    const payload = (await response.json()) as { user: BackendUser };
    const user = normalizeBackendUser(payload.user);
    await forwardBackendSession(response);
    await establishOptimisticSession(user);
    return { ok: true, message: "Welcome back.", data: user };
  } catch {
    const role = roleForEmail(email);
    const user: User = { id: `demo_${role}`, name: role === "admin" ? "Avery Admin" : "Maya Chen", email, role, organization: "Northstar Security" };
    await establishOptimisticSession(user, true);
    return { ok: true, message: "Signed in to the local mock workspace.", data: user };
  }
}

export async function registerAction(input: { name: string; email: string; password: string; acceptTerms: boolean }): Promise<ActionResult<User>> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, message: "Enter your full name.", fieldErrors: { name: "Enter at least 2 characters." } };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." } };
  if (input.password.length < 10 || !/[a-z]/.test(input.password) || !/[A-Z]/.test(input.password) || !/\d/.test(input.password) || !/[^A-Za-z0-9]/.test(input.password)) return { ok: false, message: "Use 10+ characters with uppercase, lowercase, a number, and a symbol.", fieldErrors: { password: "Use 10+ characters, uppercase, lowercase, a number, and a symbol." } };
  if (!input.acceptTerms) return { ok: false, message: "Confirm that you will only scan authorized targets.", fieldErrors: { acceptTerms: "Authorization confirmation is required." } };

  try {
    const response = await fetch(`${backendUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fullName: name, email, password: input.password }),
      signal: AbortSignal.timeout(3_500),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await backendError(response, "We could not create your account.") };
    }
    const payload = (await response.json()) as { user: BackendUser };
    const user = normalizeBackendUser(payload.user);
    await forwardBackendSession(response);
    await establishOptimisticSession(user);
    return { ok: true, message: "Account created.", data: user };
  } catch {
    const user: User = { id: `demo_${Date.now()}`, name, email, role: "user", organization: `${name.split(" ")[0]}'s workspace` };
    await establishOptimisticSession(user, true);
    return { ok: true, message: "Demo account created.", data: user };
  }
}

export async function forgotPasswordAction(email: string): Promise<ActionResult> {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return { ok: false, message: "Enter the email associated with your account." };
  try {
    await fetch(`${backendUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      signal: AbortSignal.timeout(3_500),
    });
  } catch {
    // The MVP intentionally returns the same response in mock mode to avoid account enumeration.
  }
  return { ok: true, message: "If an account exists, reset instructions are on the way." };
}

export async function logoutAction(): Promise<ActionResult> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  try {
    await fetch(`${backendUrl}/api/auth/logout`, { method: "POST", headers: { cookie: cookieHeader }, signal: AbortSignal.timeout(2_500) });
  } catch {
    // Local session cleanup still succeeds when the API is offline.
  }
  for (const name of ["pan_session", "pan_role", "access_token", "access_token_cookie"]) cookieStore.delete(name);
  return { ok: true, message: "Signed out." };
}
