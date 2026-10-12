// Server-only backend-for-frontend client. Attaches the httpOnly access-token
// cookie to backend calls and transparently refreshes once on a 401.
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const BASE = process.env.API_BASE_URL ?? "http://localhost:4000";
const ACCESS = "fs_access";
const REFRESH = "fs_refresh";
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export function setAuthCookies(accessToken: string, refreshToken: string) {
  setCookie(ACCESS, accessToken, { ...cookieOpts, maxAge: 60 * 15 });
  setCookie(REFRESH, refreshToken, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
}

export function clearAuthCookies() {
  deleteCookie(ACCESS, cookieOpts);
  deleteCookie(REFRESH, cookieOpts);
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function raw(path: string, init: RequestInit, token?: string) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      body?.code ?? "ERROR",
      body?.message ?? res.statusText,
      res.status,
    );
  }
  return body;
}

async function tryRefresh(): Promise<string | null> {
  const refresh = getCookie(REFRESH);
  if (!refresh) return null;
  try {
    const r = await raw("/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refresh }),
    });
    setAuthCookies(r.accessToken, r.refreshToken);
    return r.accessToken as string;
  } catch {
    clearAuthCookies();
    return null;
  }
}

/** Authenticated backend call with one transparent refresh on 401. */
export async function apiAuthed(path: string, init: RequestInit = {}) {
  let token = getCookie(ACCESS);
  if (!token) {
    token = (await tryRefresh()) ?? undefined;
    if (!token) throw new ApiError("UNAUTHORIZED", "Not signed in", 401);
  }
  try {
    return await raw(path, init, token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const fresh = await tryRefresh();
      if (fresh) return raw(path, init, fresh);
    }
    throw e;
  }
}

/** Public backend call (no auth). */
export const apiPublic = (path: string, init: RequestInit = {}) => raw(path, init);
export { raw as apiRaw };
