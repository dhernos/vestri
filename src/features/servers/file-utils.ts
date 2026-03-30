import type { ConfigRow, WorkerListEntry } from "@/features/servers/types";

const keyValueFormats = new Set(["properties", "env", "ini", "cfg", "config", "kv"]);

export const normalizeRelativePath = (value: string) => {
  const parts = value
    .replaceAll("\\", "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== ".");

  const clean: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      clean.pop();
      continue;
    }
    clean.push(part);
  }
  return clean.join("/");
};

export const parentRelativePath = (value: string) => {
  const clean = normalizeRelativePath(value);
  if (!clean) {
    return "";
  }
  const parts = clean.split("/");
  parts.pop();
  return parts.join("/");
};

export const sortEntries = (entries: WorkerListEntry[]) =>
  [...entries].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });

export const downloadNameFromResponse = (contentDisposition: string | null, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      // fallback below
    }
  }

  const plainMatch = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallback;
};

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "-";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

export const isZipArchiveName = (name: string) => name.trim().toLowerCase().endsWith(".zip");

export const decodeEscapedLineBreaks = (value: string) => {
  if (value.includes("\n") || value.includes("\r")) {
    return value;
  }
  return value
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r");
};

export const shouldUseKeyValueEditor = (format: string, content: string) => {
  const normalizedFormat = format.trim().toLowerCase();
  if (keyValueFormats.has(normalizedFormat)) {
    return true;
  }

  const lines = content
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length === 0) {
    return false;
  }

  const dataLines = lines.filter(
    (line) => !line.startsWith("#") && !line.startsWith(";")
  );
  if (dataLines.length === 0) {
    return false;
  }

  return dataLines.every((line) => line.includes("=") || line.includes(":"));
};

export const parseConfigRows = (content: string): ConfigRow[] => {
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  const rows: ConfigRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
      rows.push({
        id: `row-${i}-${Math.random().toString(36).slice(2, 9)}`,
        key: line,
        value: "",
        keyLocked: true,
        valueLocked: true,
        custom: false,
      });
      continue;
    }

    const eqIdx = line.indexOf("=");
    const colonIdx = line.indexOf(":");
    let splitAt = -1;
    if (eqIdx >= 0 && colonIdx >= 0) {
      splitAt = Math.min(eqIdx, colonIdx);
    } else if (eqIdx >= 0) {
      splitAt = eqIdx;
    } else if (colonIdx >= 0) {
      splitAt = colonIdx;
    }

    if (splitAt < 0) {
      rows.push({
        id: `row-${i}-${Math.random().toString(36).slice(2, 9)}`,
        key: line,
        value: "",
        keyLocked: true,
        valueLocked: true,
        custom: false,
      });
      continue;
    }

    rows.push({
      id: `row-${i}-${Math.random().toString(36).slice(2, 9)}`,
      key: line.slice(0, splitAt).trim(),
      value: line.slice(splitAt + 1),
      keyLocked: true,
      valueLocked: false,
      custom: false,
    });
  }

  return rows;
};

export const serializeConfigRows = (rows: ConfigRow[]) => {
  const lines: string[] = [];
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value;

    if (row.custom && key === "" && value.trim() === "") {
      continue;
    }
    if (row.valueLocked && !row.custom) {
      if (row.key.trim() !== "") {
        lines.push(row.key);
      }
      continue;
    }
    if (key === "") {
      continue;
    }
    lines.push(`${key}=${value}`);
  }

  if (lines.length === 0) {
    return "";
  }
  return `${lines.join("\n")}\n`;
};
