import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { GameServerListItem } from "./types.ts";

const loadModule = <Module>(path: string): Module => {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const moduleExports = {};
  new Function("exports", compiled)(moduleExports);
  return moduleExports as Module;
};
const { databaseJdbcUrl, databaseResponseError, isValidDatabaseDisplayName } =
  loadModule<typeof import("./databases")>("./databases.ts");
const {
  canManageServerDatabases,
  isServerWorkspaceSection,
  buildServerWorkspacePath,
} = loadModule<typeof import("./navigation")>("./navigation.ts");

test("database access requires server administration and Minecraft or Velocity", () => {
  const server = (canManage: boolean, game?: string, kind?: string) =>
    ({ permissions: { canManage }, game, kind }) as GameServerListItem;
  assert.equal(canManageServerDatabases(server(true, "minecraft")), true);
  assert.equal(
    canManageServerDatabases(server(true, "Minecraft", "velocity-backend")),
    true,
  );
  assert.equal(
    canManageServerDatabases(server(true, undefined, "velocity")),
    true,
  );
  assert.equal(canManageServerDatabases(server(false, "minecraft")), false);
  assert.equal(
    canManageServerDatabases(server(false, undefined, "velocity")),
    false,
  );
  assert.equal(canManageServerDatabases(server(true, "satisfactory")), false);
  assert.equal(canManageServerDatabases(server(true)), false);
});

test("databases is a standalone workspace route", () => {
  assert.equal(isServerWorkspaceSection("databases"), true);
  assert.equal(
    buildServerWorkspacePath("node one", "server", "databases"),
    "/servers/node%20one/server/databases",
  );
});

test("database display names require 1 to 48 non-whitespace characters", () => {
  assert.equal(isValidDatabaseDisplayName(""), false);
  assert.equal(isValidDatabaseDisplayName("   "), false);
  assert.equal(isValidDatabaseDisplayName(" Player statistics "), true);
  assert.equal(isValidDatabaseDisplayName("a".repeat(48)), true);
  assert.equal(isValidDatabaseDisplayName("a".repeat(49)), false);
});

test("JDBC uses the correct engine scheme and returned internal port", () => {
  assert.equal(
    databaseJdbcUrl({
      engine: "mariadb",
      host: "db-maria",
      port: 3306,
      database: "generated_db",
    }),
    "jdbc:mysql://db-maria:3306/generated_db",
  );
  assert.equal(
    databaseJdbcUrl({
      engine: "postgres",
      host: "db-postgres",
      port: 5432,
      database: "generated_db",
    }),
    "jdbc:postgresql://db-postgres:5432/generated_db",
  );
  assert.equal(
    databaseJdbcUrl({
      engine: "postgres",
      host: "::1",
      port: 5433,
      database: "db",
    }),
    "jdbc:postgresql://[::1]:5433/db",
  );
  assert.equal(
    databaseJdbcUrl({
      engine: "mariadb",
      host: "[::1]",
      port: 3306,
      database: "db",
    }),
    "jdbc:mysql://[::1]:3306/db",
  );
});

test("API errors support JSON, plain text, empty and unexpected bodies", async () => {
  for (const [body, expected] of [
    ['{"message":" Already exists "}', "Already exists"],
    ['{"error":" Engine unavailable "}', "Engine unavailable"],
    [" worker unavailable ", "worker unavailable"],
    ["", "Fallback"],
    ["null", "null"],
    ['{"error":false}', '{"error":false}'],
  ]) {
    assert.equal(
      await databaseResponseError(
        new Response(body, { status: 400 }),
        "Fallback",
      ),
      expected,
    );
  }
});

test("English and German database translations have identical keys and placeholders", () => {
  const require = createRequire(import.meta.url);
  const english = require("../../../messages/en.json").ServerPage.databases;
  const german = require("../../../messages/de.json").ServerPage.databases;
  const check = (
    left: Record<string, unknown>,
    right: Record<string, unknown>,
  ) => {
    assert.deepEqual(Object.keys(left).sort(), Object.keys(right).sort());
    for (const key of Object.keys(left)) {
      if (typeof left[key] === "object")
        check(
          left[key] as Record<string, unknown>,
          right[key] as Record<string, unknown>,
        );
      else
        assert.deepEqual(
          String(left[key]).match(/\{\w+\}/g),
          String(right[key]).match(/\{\w+\}/g),
        );
    }
  };
  check(english, german);
});

test("database component keeps credentials read-only and requires exact delete confirmation", () => {
  const component = readFileSync(
    new URL(
      "../../components/servers/cards/databases-section.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    component,
    /if \(action === "delete" && confirmation !== target\?\.name\) return/,
  );
  assert.match(component, /confirm: confirmation/);
  assert.match(component, /secret && !revealed \? "password" : "text"/);
  assert.match(component, /readOnly/);
  assert.match(component, /useState<DatabaseEngine>\("mariadb"\)/);
  assert.equal((component.match(/credentials: "include"/g) || []).length, 2);
});
