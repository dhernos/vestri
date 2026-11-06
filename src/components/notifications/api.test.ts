import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {} as { deleteNotifications: (id?: string) => Promise<void> };
new Function("exports", compiled)(moduleExports);

test("deletes one encoded notification and accepts an empty 204 response", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  await moduleExports.deleteNotifications("id/with space");
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ["/api/notifications/id%2Fwith%20space", { method: "DELETE", credentials: "include" }]);
});

test("clears all notifications using DELETE on the collection", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  await moduleExports.deleteNotifications();
  assert.equal(fetchMock.mock.calls[0].arguments[0], "/api/notifications");
  assert.equal(fetchMock.mock.calls[0].arguments[1]?.method, "DELETE");
});

test("surfaces unsupported routes without falling back to mark-read", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 405 }));
  await assert.rejects(moduleExports.deleteNotifications("missing"), /deletion failed/);
  assert.equal(fetchMock.mock.callCount(), 1);
});