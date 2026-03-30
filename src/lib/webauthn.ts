import { GoUser } from "@/lib/auth-client";

type CredentialDescriptorJSON = {
  id: string;
  type?: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
  [key: string]: unknown;
};

type CredentialCreationOptionsJSON = {
  publicKey: {
    challenge: string;
    rp: PublicKeyCredentialRpEntity;
    user: {
      id: string;
      name: string;
      displayName: string;
      [key: string]: unknown;
    };
    pubKeyCredParams: PublicKeyCredentialParameters[];
    timeout?: number;
    attestation?: AttestationConveyancePreference;
    authenticatorSelection?: AuthenticatorSelectionCriteria;
    excludeCredentials?: CredentialDescriptorJSON[];
    extensions?: AuthenticationExtensionsClientInputs;
    [key: string]: unknown;
  };
};

type CredentialRequestOptionsJSON = {
  publicKey: {
    challenge: string;
    timeout?: number;
    allowCredentials?: CredentialDescriptorJSON[];
    rpId?: string;
    userVerification?: UserVerificationRequirement;
    extensions?: AuthenticationExtensionsClientInputs;
    [key: string]: unknown;
  };
};

export type PasskeyError =
  | "UNSUPPORTED"
  | "START_FAILED"
  | "CREATE_CANCELLED"
  | "FINISH_FAILED"
  | "LOGIN_START_FAILED"
  | "LOGIN_CANCELLED"
  | "LOGIN_FINISH_FAILED";

export const passkeyFallbackCodes = {
  secureContextRequired: "PASSKEY_SECURE_CONTEXT_REQUIRED",
  creationRpIdMismatch: "PASSKEY_CREATION_RP_ID_MISMATCH",
  creationBlocked: "PASSKEY_CREATION_BLOCKED",
  loginSecureContextRequired: "PASSKEY_LOGIN_SECURE_CONTEXT_REQUIRED",
  loginRpIdMismatch: "PASSKEY_LOGIN_RP_ID_MISMATCH",
  loginBlocked: "PASSKEY_LOGIN_BLOCKED",
} as const;

const jsonFetchInit: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

const isMessageCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9_]+$/.test(value);

const bufferToBase64url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const base64urlToBuffer = (base64url: string): ArrayBuffer => {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return buffer;
};

const transformCreationOptions = (opts: CredentialCreationOptionsJSON) => {
  const source = opts.publicKey;
  const {
    challenge,
    user,
    excludeCredentials,
    ...rest
  } = source;
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(rest as Omit<
      PublicKeyCredentialCreationOptions,
      "challenge" | "user" | "excludeCredentials"
    >),
    challenge: base64urlToBuffer(challenge),
    user: {
      ...user,
      id: base64urlToBuffer(user.id),
    },
  };
  if (excludeCredentials) {
    publicKey.excludeCredentials = excludeCredentials.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
      type: cred.type ?? "public-key",
    }));
  }
  return { publicKey };
};

const transformRequestOptions = (opts: CredentialRequestOptionsJSON) => {
  const source = opts.publicKey;
  const {
    challenge,
    allowCredentials,
    ...rest
  } = source;
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...(rest as Omit<
      PublicKeyCredentialRequestOptions,
      "challenge" | "allowCredentials"
    >),
    challenge: base64urlToBuffer(challenge),
  };
  if (allowCredentials) {
    publicKey.allowCredentials = allowCredentials.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
      type: cred.type ?? "public-key",
    }));
  }
  return { publicKey };
};

const credentialToJSON = (cred: PublicKeyCredential) => {
  const response = cred.response as AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
  const clientDataJSON = bufferToBase64url(response.clientDataJSON);

  if ("attestationObject" in response) {
    return {
      id: cred.id,
      rawId: bufferToBase64url(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON,
        attestationObject: bufferToBase64url(response.attestationObject),
      },
    };
  }

  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON,
      authenticatorData: bufferToBase64url((response as AuthenticatorAssertionResponse).authenticatorData),
      signature: bufferToBase64url((response as AuthenticatorAssertionResponse).signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
};

export async function registerPasskey(
  label?: string
): Promise<{ ok: true } | { ok: false; error: PasskeyError; fallback?: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { ok: false, error: "UNSUPPORTED" };
  }
  if (!window.isSecureContext) {
    return {
      ok: false,
      error: "START_FAILED",
      fallback: passkeyFallbackCodes.secureContextRequired,
    };
  }

  let startRes: Response;
  try {
    startRes = await fetch("/api/passkeys/register/start", {
      ...jsonFetchInit,
      method: "POST",
    });
  } catch {
    return { ok: false, error: "START_FAILED" };
  }
  if (!startRes.ok) {
    const body = await startRes.json().catch(() => ({}));
    const fallback = isMessageCode(body?.message) ? body.message : undefined;
    return { ok: false, error: "START_FAILED", fallback };
  }
  const { options, sessionId } = await startRes.json();

  const publicKeyOptions = transformCreationOptions(options);
  const rpId = publicKeyOptions?.publicKey?.rp?.id as string | undefined;
  if (rpId) {
    const host = window.location.hostname;
    if (host !== rpId && !host.endsWith(`.${rpId}`)) {
      return {
        ok: false,
        error: "START_FAILED",
        fallback: `${passkeyFallbackCodes.creationRpIdMismatch}:${rpId}`,
      };
    }
  }
  let credential: PublicKeyCredential | null = null;
  try {
    credential = (await navigator.credentials.create(publicKeyOptions)) as PublicKeyCredential | null;
  } catch (err) {
    const domErr = err as DOMException;
    if (domErr?.name === "SecurityError") {
      return {
        ok: false,
        error: "START_FAILED",
        fallback: passkeyFallbackCodes.creationBlocked,
      };
    }
    if (domErr?.name === "NotAllowedError") {
      return { ok: false, error: "CREATE_CANCELLED" };
    }
    return { ok: false, error: "START_FAILED" };
  }
  if (!credential) {
    return { ok: false, error: "CREATE_CANCELLED" };
  }

  const encoded = credentialToJSON(credential);
  const finishUrl = new URL("/api/passkeys/register/finish", window.location.origin);
  finishUrl.searchParams.set("sessionId", sessionId);
  if (label && label.trim() !== "") {
    finishUrl.searchParams.set("label", label.trim());
  }
  try {
    const finishRes = await fetch(finishUrl.toString(), {
      ...jsonFetchInit,
      method: "POST",
      body: JSON.stringify(encoded),
    });
    if (!finishRes.ok) {
      const body = await finishRes.json().catch(() => ({}));
      const fallback = isMessageCode(body?.message) ? body.message : undefined;
      return { ok: false, error: "FINISH_FAILED", fallback };
    }
  } catch {
    return { ok: false, error: "FINISH_FAILED" };
  }
  return { ok: true };
}

export async function loginWithPasskey(
  email: string
): Promise<
  | { ok: true; user: GoUser; sessionId?: string }
  | { ok: false; error: PasskeyError; fallback?: string }
> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { ok: false, error: "UNSUPPORTED" };
  }
  if (!window.isSecureContext) {
    return {
      ok: false,
      error: "LOGIN_START_FAILED",
      fallback: passkeyFallbackCodes.loginSecureContextRequired,
    };
  }

  let startRes: Response;
  try {
    startRes = await fetch("/api/passkeys/login/start", {
      ...jsonFetchInit,
      method: "POST",
      body: JSON.stringify({ email }),
    });
  } catch {
    return { ok: false, error: "LOGIN_START_FAILED" };
  }
  if (!startRes.ok) {
    const body = await startRes.json().catch(() => ({}));
    const fallback = isMessageCode(body?.message) ? body.message : undefined;
    return { ok: false, error: "LOGIN_START_FAILED", fallback };
  }
  const { options, sessionId } = await startRes.json();

  const requestOptions = transformRequestOptions(options);
  const rpId = requestOptions?.publicKey?.rpId as string | undefined;
  if (rpId) {
    const host = window.location.hostname;
    if (host !== rpId && !host.endsWith(`.${rpId}`)) {
      return {
        ok: false,
        error: "LOGIN_START_FAILED",
        fallback: `${passkeyFallbackCodes.loginRpIdMismatch}:${rpId}`,
      };
    }
  }
  let assertion: PublicKeyCredential | null = null;
  try {
    assertion = (await navigator.credentials.get(requestOptions)) as PublicKeyCredential | null;
  } catch (err) {
    const domErr = err as DOMException;
    if (domErr?.name === "SecurityError") {
      return {
        ok: false,
        error: "LOGIN_START_FAILED",
        fallback: passkeyFallbackCodes.loginBlocked,
      };
    }
    if (domErr?.name === "NotAllowedError") {
      return { ok: false, error: "LOGIN_CANCELLED" };
    }
    return { ok: false, error: "LOGIN_START_FAILED" };
  }
  if (!assertion) {
    return { ok: false, error: "LOGIN_CANCELLED" };
  }

  const encoded = credentialToJSON(assertion);
  const finishUrl = new URL("/api/passkeys/login/finish", window.location.origin);
  finishUrl.searchParams.set("sessionId", sessionId);
  let finishRes: Response;
  try {
    finishRes = await fetch(finishUrl.toString(), {
      ...jsonFetchInit,
      method: "POST",
      body: JSON.stringify(encoded),
    });
  } catch {
    return { ok: false, error: "LOGIN_FINISH_FAILED" };
  }
  if (!finishRes.ok) {
    const body = await finishRes.json().catch(() => ({}));
    const fallback = isMessageCode(body?.message) ? body.message : undefined;
    return { ok: false, error: "LOGIN_FINISH_FAILED", fallback };
  }
  const data = await finishRes.json();
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
