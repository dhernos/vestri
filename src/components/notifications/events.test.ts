import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createTranslator } from "next-intl";
import ts from "typescript";

const source = readFileSync(new URL("./events.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const helpers = {} as typeof import("./events");
new Function("exports", compiled)(helpers);
const expectedKinds = [
  "server_created", "server_deleted", "worker_unhealthy", "server_down",
  "worker_recovered", "server_recovered", "server_invited", "server_access_granted",
  "server_role_changed", "server_access_removed",
];

test("every backend notification kind is available as a delivery toggle", () => {
  assert.deepEqual(helpers.eventKinds, expectedKinds);
  assert.equal(new Set(helpers.eventKinds).size, expectedKinds.length);
});

for (const locale of ["en", "de"]) {
  const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8"));
  const t = createTranslator({ locale, messages, namespace: "NotificationsPage", onError(error) { throw error; } });

  test(`${locale}: all events have labels and render messages with localized roles`, () => {
    assert.deepEqual(Object.keys(messages.NotificationsPage.events).sort(), [...expectedKinds].sort());
    assert.deepEqual(Object.keys(messages.NotificationsPage.messages).sort(), [...expectedKinds].sort());
    for (const role of ["viewer", "operator", "admin"]) {
      const values = helpers.notificationMessageValues({ serverName: "Survival", nodeName: "West", actorName: "Alex", role }, t);
      assert.equal(values.role, t(`roles.${role}`));
      assert.notEqual(values.role, role);
      for (const kind of helpers.eventKinds) {
        assert.ok(t(`events.${kind}`));
        const text = t(`messages.${kind}`, values);
        assert.doesNotMatch(text, /\{[^}]+\}|NotificationsPage\./);
        if (kind.startsWith("server_")) assert.ok(text.includes("Survival"));
        if (["server_invited", "server_access_granted", "server_role_changed", "server_access_removed"].includes(kind)) {
          assert.ok(text.includes("Alex"));
          assert.ok(text.includes(values.role));
        }
        if (kind === "worker_recovered" || kind === "server_recovered") assert.ok(text.includes("West"));
      }
    }
  });

  test(`${locale}: invitations differ from access grants and removal names the previous role`, () => {
    const values = helpers.notificationMessageValues({ serverName: "Survival", nodeName: "West", actorName: "Alex", role: "viewer" }, t);
    assert.match(t("messages.server_invited", values), locale === "en" ? /invited you/ : /eingeladen/);
    assert.match(t("messages.server_access_granted", values), locale === "en" ? /granted you access/ : /Zugriff.*gewährt/);
    assert.match(t("messages.server_access_removed", values), locale === "en" ? /previous role:/ : /bisherige Rolle:/);
  });
}

test("older notices and unknown roles do not request missing role translations", () => {
  const translateRole = () => { throw new Error("unexpected role lookup"); };
  assert.deepEqual(helpers.notificationMessageValues({ serverName: "Survival", nodeName: "West" }, translateRole), {
    server: "Survival", node: "West", actor: "", role: "",
  });
  assert.equal(helpers.notificationMessageValues({ serverName: "Survival", nodeName: "West", role: "future-role" }, translateRole).role, "future-role");
});