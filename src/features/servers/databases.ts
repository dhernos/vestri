export type DatabaseEngine = "mariadb" | "postgres";

export type DatabaseEntry = {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  state: "running" | "stopped" | "starting" | "unknown";
  error?: string;
};

export type DatabaseTemplate = { id: DatabaseEngine; name: string; port: number };
export type DatabaseState = { databases: DatabaseEntry[]; templates: DatabaseTemplate[] };
export type DatabaseAction = "start" | "stop" | "delete";

export const isValidDatabaseDisplayName = (name: string) =>
  name.trim().length > 0 && name.trim().length <= 48;

export const databaseJdbcUrl = (database: Pick<DatabaseEntry, "engine" | "host" | "port" | "database">) => {
  const host = database.host.includes(":") && !database.host.startsWith("[")
    ? `[${database.host}]`
    : database.host;
  return `jdbc:${database.engine === "mariadb" ? "mysql" : "postgresql"}://${host}:${database.port}/${database.database}`;
};

export async function databaseResponseError(response: Response, fallback: string) {
  const text = (await response.text().catch(() => "")).trim();
  if (!text) return fallback;
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object") {
      const { message, error } = body as { message?: unknown; error?: unknown };
      if (typeof message === "string" && message.trim()) return message.trim();
      if (typeof error === "string" && error.trim()) return error.trim();
    }
  } catch {
    return text;
  }
  return text;
}