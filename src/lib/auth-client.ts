// Client-side helpers for talking to the Go auth backend.
export type GoUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  theme?: string | null;
  image?: string | null;
  sessionId?: string;
  isTwoFactorEnabled?: boolean;
  twoFactorMethod?: string | null;
  twoFactorVerified?: boolean;
  twoFactorVerifiedAt?: string | null;
  hasPassword?: boolean;
  oauthLinked?: boolean;
};

export type GoSession = {
  user: GoUser;
  error?: string;
};

export type GoPasskey = {
  id: string;
  label?: string | null;
  createdAt?: string;
  transports?: string[];
};

type LoginResult =
  | { ok: true; user: GoUser; sessionId: string }
  | { ok: false; twoFactorRequired?: boolean; message: string };

const defaultFetchInit: RequestInit = {
  headers: { "Content-Type": "application/json" },
  credentials: "include",
};

const isMessageCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9_]+$/.test(value);

export async function fetchSession(): Promise<GoSession | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    const user: GoUser = {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      theme: data.theme,
      image: data.image,
      sessionId: data.sessionId,
      isTwoFactorEnabled: data.twoFactorEnabled,
      twoFactorMethod: data.twoFactorMethod,
      twoFactorVerified: data.twoFactorVerified,
      twoFactorVerifiedAt: data.twoFactorVerifiedAt,
      hasPassword: data.hasPassword,
      oauthLinked: data.oauthLinked,
    };
    return { user };
  } catch {
    return null;
  }
}

export async function loginWithPassword(
  email: string,
  password: string,
  code?: string,
  rememberMe?: boolean
): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    ...defaultFetchInit,
    method: "POST",
    body: JSON.stringify({ email, password, code, rememberMe }),
  });

  if (!res.ok) {
    const body = await safeJson(res);
    if (res.status === 403 && body?.message === "TWO_FACTOR_REQUIRED") {
      return { ok: false, twoFactorRequired: true, message: body?.message };
    }
    const message = isMessageCode(body?.message)
      ? body.message
      : "INVALID_CREDENTIALS";
    return { ok: false, message };
  }

  const data = await safeJson(res);
  const u = data?.user || {};
  const user: GoUser = {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    theme: u.theme,
    image: u.image,
    sessionId: data?.sessionId,
    isTwoFactorEnabled: u.isTwoFactorEnabled ?? u.twoFactorEnabled,
    twoFactorMethod: u.twoFactorMethod,
    twoFactorVerified: true,
    twoFactorVerifiedAt: new Date().toISOString(),
    hasPassword: u.hasPassword ?? true,
    oauthLinked: u.oauthLinked ?? false,
  };
  return { ok: true, user, sessionId: data?.sessionId };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export async function fetchPasskeys(): Promise<GoPasskey[]> {
  const res = await fetch("/api/passkeys", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data?.passkeys || [];
}

export async function deletePasskey(id: string): Promise<boolean> {
  const res = await fetch(`/api/passkeys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

export function startOAuth(provider: "github" | "discord", returnTo: string = "/") {
  const url = new URL(`/api/oauth/${provider}/start`, window.location.origin);
  url.searchParams.set("returnTo", returnTo);
  window.location.href = url.toString();
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
