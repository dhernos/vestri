import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function detectMimeType(bytes: Uint8Array): string {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return "";
}

function normalizeMimeType(inputType: string, bytes: Uint8Array): string | null {
  const reported = inputType.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(reported)) {
    return reported === "image/jpg" ? "image/jpeg" : reported;
  }

  const detected = detectMimeType(bytes);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected)) {
    return null;
  }

  return detected === "image/jpg" ? "image/jpeg" : detected;
}

function extensionForMimeType(mimeType: string): "png" | "jpg" | "webp" {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function resolveUploadDirectory(imagePath: string): string | null {
  const withoutQuery = imagePath.split("?")[0].trim();
  if (!withoutQuery.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = path.posix.normalize(withoutQuery.slice("/uploads/".length));
  if (
    !relativePath ||
    relativePath === "." ||
    relativePath.startsWith("..") ||
    relativePath.includes("/../") ||
    relativePath.includes("\\")
  ) {
    return null;
  }

  const relativeDir = path.posix.dirname(relativePath);
  if (!relativeDir || relativeDir === ".") {
    return null;
  }

  const candidate = path.resolve(UPLOADS_ROOT, ...relativeDir.split("/"));
  const root = path.resolve(UPLOADS_ROOT);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    return null;
  }

  return candidate;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: unknown; error?: unknown }
    | null;
  if (typeof payload?.message === "string" && payload.message.trim() !== "") {
    return payload.message;
  }
  if (typeof payload?.error === "string" && payload.error.trim() !== "") {
    return payload.error;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: "Invalid form data" }, { status: 400 });
  }

  const imagePart = formData.get("image");
  if (!(imagePart instanceof File)) {
    return Response.json({ message: "No file uploaded" }, { status: 400 });
  }

  if (imagePart.size > MAX_FILE_SIZE_BYTES) {
    return Response.json({ message: "File too large. Max 3MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await imagePart.arrayBuffer());
  const mimeType = normalizeMimeType(imagePart.type, bytes);
  if (!mimeType) {
    return Response.json({ message: "Invalid image format." }, { status: 400 });
  }

  const ext = extensionForMimeType(mimeType);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const fileName = `profile.${ext}`;
  const uploadDir = path.join(UPLOADS_ROOT, hash);
  const filePath = path.join(uploadDir, fileName);

  try {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, bytes);
  } catch {
    return Response.json({ message: "Failed to save image" }, { status: 500 });
  }

  const imageURL = `/uploads/${hash}/${fileName}`;

  let previousImage: string | null = null;
  try {
    const meResponse = await fetch(`${GO_API_URL}/api/auth/me`, {
      method: "GET",
      headers: { cookie },
      cache: "no-store",
    });

    if (meResponse.ok) {
      const mePayload = (await meResponse.json().catch(() => null)) as
        | { image?: unknown }
        | null;
      if (typeof mePayload?.image === "string" && mePayload.image.trim() !== "") {
        previousImage = mePayload.image;
      }
    }
  } catch {
    // Continue without previous image cleanup context.
  }

  const updateResponse = await fetch(`${GO_API_URL}/api/profile/update-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify({ imageUrl: imageURL }),
  });

  if (!updateResponse.ok) {
    const message = await readErrorMessage(updateResponse, "Failed to update image");
    return Response.json({ message }, { status: updateResponse.status });
  }

  if (previousImage && previousImage !== imageURL) {
    const previousDir = resolveUploadDirectory(previousImage);
    if (previousDir) {
      const currentDir = path.resolve(uploadDir);
      const targetDir = path.resolve(previousDir);
      if (targetDir !== currentDir) {
        try {
          await rm(targetDir, { recursive: true, force: true });
        } catch {
          // Keep upload success even when cleanup fails.
        }
      }
    }
  }

  return Response.json(
    {
      message: "Uploaded successfully",
      imageUrl: imageURL,
    },
    { status: 200 }
  );
}
