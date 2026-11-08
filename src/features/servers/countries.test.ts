import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("./countries.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const moduleExports = {};
new Function("exports", compiled)(moduleExports);
const {
  COUNTRY_CODES,
  isCountryCode,
  countryName,
  countryMatches,
  countryPolicyState,
} = moduleExports as typeof import("./countries");

test("country codes are the exact 249 unique ISO 3166-1 alpha-2 codes", () => {
  assert.equal(COUNTRY_CODES.length, 249);
  assert.equal(new Set(COUNTRY_CODES).size, 249);
  for (const code of ["DE", "US", "GB", "AX", "BQ", "SS", "AQ", "UM"])
    assert.equal(isCountryCode(code), true);
  for (const code of [
    "UK",
    "XK",
    "EU",
    "ZZ",
    "us",
    " DE ",
    "USA",
    "",
    undefined,
  ])
    assert.equal(isCountryCode(code), false);
});

test("country names and search follow the selected locale", () => {
  assert.equal(countryName("DE", "en"), "Germany");
  assert.equal(countryName("DE", "de"), "Deutschland");
  assert.equal(countryName("ZZ", "en"), "");
  assert.equal(countryMatches("DE", "germany", "en"), true);
  assert.equal(countryMatches("DE", " DEUTSCH ", "de"), true);
  assert.equal(countryMatches("US", "us", "en"), true);
  assert.equal(countryMatches(undefined, "", "en"), false);
  assert.equal(countryMatches("DE", "France", "en"), false);
});

test("legacy policy defaults safely without claiming country support", () => {
  assert.deepEqual(countryPolicyState(), {
    supported: false,
    enabled: false,
    allowed: [],
    banned: [],
  });
  assert.equal(
    countryPolicyState({ countryWhitelistEnabled: false }).supported,
    false,
  );
  assert.deepEqual(
    countryPolicyState({
      countryWhitelistEnabled: true,
      countryWhitelist: ["DE", "DE", "UK"],
      countryBans: ["US", "ZZ"],
    }),
    { supported: true, enabled: true, allowed: ["DE"], banned: ["US"] },
  );
});
