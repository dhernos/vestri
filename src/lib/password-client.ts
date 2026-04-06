const CLIENT_PASSWORD_NAMESPACE = "vestri-password-auth-v1";
const CLIENT_PASSWORD_PREFIX = "v1$sha256$";

export const CLIENT_PASSWORD_FORMAT = "client-sha256-v1";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export async function hashPasswordForTransport(password: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto API is unavailable");
  }

  const data = encoder.encode(`${CLIENT_PASSWORD_NAMESPACE}:${password}`);
  const digest = await subtle.digest("SHA-256", data);
  return `${CLIENT_PASSWORD_PREFIX}${toHex(digest)}`;
}
