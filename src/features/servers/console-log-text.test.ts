import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("./console-log-text.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {} as { consoleLogText: (raw: string) => string };
new Function("exports", compiled)(moduleExports);
const { consoleLogText } = moduleExports;

test("removes Velocity terminal queries, modes, colors and cursor controls", () => {
  const raw =
    "\x1b[?u\x1b[?2026$p\x1b[?2027$p\x1b[?2048$p\x1b[c[07:42:21 INFO]: Booting up Velocity\r\n" +
    "\x1b[?1h\x1b=\x1b[?2004h>....\b\b\b\b \x1b[Khelp\n" +
    "\x1b[?1l\x1b>\x1b[?1000l\x1b[?2004l\x1b[2A\x1b[46D" +
    "[07:43:16 INFO]: \x1b[1m\x1b[36mVelocity \x1b[0m\x1b[36m4.3.0\x1b[0m\n";
  assert.equal(
    consoleLogText(raw),
    "[07:42:21 INFO]: Booting up Velocity\n>.... help\n[07:43:16 INFO]: Velocity 4.3.0\n",
  );
});

test("preserves log text, Unicode, tabs and newlines", () => {
  const raw =
    "java.net.UnknownHostException: host\n\tat java.base/lookup\nGr\u00fc\u00dfe \ud83d\ude80\n";
  assert.equal(consoleLogText(raw), raw);
});

test("hides incomplete sequences until subsequent chunks complete them", () => {
  const chunks = ["start\x1b", "[?2026$", "p\x1b[33;", "1mWARN\x1b[", "m end"];
  const expected = ["start", "start", "start", "startWARN", "startWARN end"];
  let raw = "";
  chunks.forEach((chunk, index) => {
    raw += chunk;
    assert.equal(consoleLogText(raw), expected[index]);
  });
});

test("removes OSC, DCS, C1 and other control characters", () => {
  const raw =
    "\x1b]0;title\x07\x1bPquery\x1b\\\x9b31mred\x9b0m" +
    "\x1b]8;;https://example.com\x1b\\link\x1b]8;;\x1b\\" +
    "\x9dtitle\x9c\x00\x07\x7f\x1b(B!";
  assert.equal(consoleLogText(raw), "redlink!");
});
