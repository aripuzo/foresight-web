import { createServerFn } from "@tanstack/react-start";
import {
  apiPublic,
  apiAuthed,
  apiRaw,
  setAuthCookies,
  clearAuthCookies,
  ApiError,
} from "./api.server";
import { getCookie } from "@tanstack/react-start/server";

export type Me = {
  id: string;
  email: string;
  username: string;
  role: string;
  kycTier: "unverified" | "verified";
  phone: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
  bvnLast4: string | null;
  bvnVerified: boolean;
};

export const signup = createServerFn({ method: "POST" })
  .validator((d: { email: string; username: string; password: string }) => d)
  .handler(async ({ data }) => {
    const res = await apiPublic("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setAuthCookies(res.accessToken, res.refreshToken);
    return res.user as { id: string; email: string; username: string };
  });

export const login = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const res = await apiPublic("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setAuthCookies(res.accessToken, res.refreshToken);
    return res.user as { id: string; email: string; username: string };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const refreshToken = getCookie("fs_refresh");
  if (refreshToken) {
    try {
      await apiRaw("/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore: we clear cookies regardless
    }
  }
  clearAuthCookies();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async (): Promise<Me | null> => {
  try {
    return (await apiAuthed("/v1/me")) as Me;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
});
