import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("./historical-log-files.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
type LogFile = { name: string; path: string; size: number };
const moduleExports = {} as {
  sortHistoricalLogFiles: (files: LogFile[]) => LogFile[];
  selectHistoricalLogFile: (files: LogFile[], current?: string) => string;
};
new Function("exports", compiled)(moduleExports);
const { sortHistoricalLogFiles, selectHistoricalLogFile } = moduleExports;
const file = (name: string): LogFile => ({
  name,
  path: `data/logs/${name}`,
  size: 10,
});

test("selects the newest dated archive independent of API order", () => {
  const files = [
    file("2026-11-05-1.log.gz"),
    file("2026-11-06-2.log.gz"),
    file("2026-11-06-10.log.gz"),
  ];
  const sorted = sortHistoricalLogFiles(files);
  assert.equal(
    selectHistoricalLogFile(sorted),
    "data/logs/2026-11-06-10.log.gz",
  );
  assert.equal(files[0].name, "2026-11-05-1.log.gz");
});

test("prefers active logs over archives", () => {
  for (const name of ["latest.log", "current.log", "server.log"]) {
    assert.equal(
      selectHistoricalLogFile(
        sortHistoricalLogFiles([file("2026-11-06-1.log.gz"), file(name)]),
      ),
      `data/logs/${name}`,
    );
  }
});

test("preserves manual selection and falls back when it disappears", () => {
  const files = sortHistoricalLogFiles([
    file("2026-11-05-1.log.gz"),
    file("latest.log"),
  ]);
  assert.equal(
    selectHistoricalLogFile(files, "data/logs/2026-11-05-1.log.gz"),
    "data/logs/2026-11-05-1.log.gz",
  );
  assert.equal(
    selectHistoricalLogFile(files, "removed.log"),
    "data/logs/latest.log",
  );
  assert.equal(selectHistoricalLogFile([]), "");
});
