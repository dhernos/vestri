import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type * as Settings from "./minecraft-template-spec";

const source = readFileSync(
  new URL("./minecraft-template-spec.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleExports = {} as typeof Settings;
new Function("exports", compiled)(moduleExports);
const { buildTemplateSettings, newMinigameDraft, moveSetupAction } =
  moduleExports;

test("ordinary templates omit minigame and mode, even with invalid hidden settings", () => {
  assert.deepEqual(
    buildTemplateSettings("player", "5", {
      ...newMinigameDraft(),
      minPlayers: "",
    }),
    { spec: { maxInstances: 5 } },
  );
});

test("minigames serialize the complete contract and ordered repetition scopes", () => {
  const result = buildTemplateSettings("minigames", "5", {
    ...newMinigameDraft(),
    teams: " red, blue, ",
    teamSize: "2",
    maxPlayers: "4",
    readyServers: "5",
    readyTrigger: "explicit",
    logPattern: " Game finished ",
    actions: [
      { command: " setup " },
      { command: "assign {team}", forEach: "team" },
      { command: "join {player}", forEach: "player" },
    ],
  });
  assert.deepEqual(result, {
    spec: {
      maxInstances: 5,
      mode: "minigames",
      minigame: {
        teams: ["red", "blue"],
        teamSize: 2,
        minPlayers: 2,
        maxPlayers: 4,
        joinTimeout: "20s",
        readyServers: 5,
        lifecycle: {
          ready: { trigger: "explicit" },
          onAllJoined: [
            { command: "setup" },
            { command: "assign {team}", forEach: "team" },
            { command: "join {player}", forEach: "player" },
          ],
          end: {
            logPattern: "Game finished",
            whenEmpty: true,
            emptyGrace: "10s",
            returnPlayersTo: "lobby",
            deleteServer: true,
          },
        },
      },
    },
  });
});

test("default minigames have valid teams and omit an absent end pattern", () => {
  const result = buildTemplateSettings("minigames", "5", newMinigameDraft());
  assert.ok("spec" in result);
  assert.deepEqual(result.spec.minigame?.teams, ["red", "blue"]);
  assert.equal(result.spec.minigame?.teamSize, 1);
  assert.equal(result.spec.minigame?.minPlayers, 2);
  assert.equal(result.spec.minigame?.maxPlayers, 2);
  assert.equal(result.spec.minigame?.lifecycle.ready.trigger, "serverLoad");
  assert.equal("logPattern" in result.spec.minigame!.lifecycle.end, false);
});

test("invalid numbers, caps, teams, durations and missing termination are rejected", () => {
  for (const limit of ["", "0", "101", "1.5", "1e2", "NaN"])
    assert.deepEqual(
      buildTemplateSettings("player", limit, newMinigameDraft()),
      { error: "maxInstances" },
    );
  const cases: [
    Partial<Settings.MinigameDraft>,
    Settings.TemplateValidationError,
  ][] = [
    [{ minPlayers: "" }, "numbers"],
    [{ teamSize: "0" }, "numbers"],
    [{ maxPlayers: "9007199254740992" }, "numbers"],
    [{ minPlayers: "3" }, "players"],
    [{ teams: "red, red" }, "teams"],
    [{ teams: "red\nblue" }, "teams"],
    [{ teams: "red", teamSize: "1" }, "capacity"],
    [{ readyServers: "6" }, "readyServers"],
    [{ readyServers: "-1" }, "readyServers"],
    [{ joinTimeout: "0" }, "duration"],
    [{ emptyGrace: "-1" }, "duration"],
    [{ whenEmpty: false }, "end"],
    [{ actions: [{ command: " " }] }, "actions"],
    [{ actions: [{ command: "one\ntwo" }] }, "actions"],
    [{ teams: "", actions: [{ command: "assign", forEach: "team" }] }, "teams"],
  ];
  for (const [patch, error] of cases)
    assert.deepEqual(
      buildTemplateSettings("minigames", "5", {
        ...newMinigameDraft(),
        ...patch,
      }),
      { error },
    );
});

test("log-only ending supports the minimum one-second empty grace", () => {
  const result = buildTemplateSettings("minigames", "1", {
    ...newMinigameDraft(),
    whenEmpty: false,
    logPattern: "Finished",
    emptyGrace: "1",
  });
  assert.ok("spec" in result);
  assert.equal(result.spec.minigame?.lifecycle.end.whenEmpty, false);
  assert.equal(result.spec.minigame?.lifecycle.end.emptyGrace, "1s");
});

test("team IDs, counts, player limits and timeouts enforce contract boundaries", () => {
  const check = (patch: Partial<Settings.MinigameDraft>) =>
    buildTemplateSettings("minigames", "100", {
      ...newMinigameDraft(),
      ...patch,
    });
  for (const teams of [
    "",
    " , , ",
    "red,red",
    "_red,blue",
    "-red,blue",
    "red blue,blue",
    "réd,blue",
    "red/blue",
    "a".repeat(65),
    "red\nblue",
    Array.from({ length: 101 }, (_, index) => `team${index}`).join(","),
  ])
    assert.deepEqual(check({ teams }), { error: "teams" }, teams);
  for (const key of ["teamSize", "minPlayers", "maxPlayers"] as const) {
    for (const value of ["", "0", "101", "-1", "1.5", "1e2", "NaN"])
      assert.deepEqual(
        check({ [key]: value }),
        { error: "numbers" },
        `${key}=${value}`,
      );
  }
  for (const key of ["joinTimeout", "emptyGrace"] as const) {
    for (const value of ["", "0", "601", "-1", "1.5", "1s"])
      assert.deepEqual(
        check({ [key]: value }),
        { error: "duration" },
        `${key}=${value}`,
      );
    for (const value of ["1", "600"])
      assert.ok("spec" in check({ [key]: value }));
  }
  assert.deepEqual(check({ minPlayers: "3" }), { error: "players" });
  assert.deepEqual(check({ maxPlayers: "3" }), { error: "capacity" });
  for (const patch of [
    { teams: "0", minPlayers: "1", maxPlayers: "1" },
    {
      teams: `${"a".repeat(64)},Z_9-`,
      teamSize: "100",
      minPlayers: "100",
      maxPlayers: "100",
    },
    {
      teams: Array.from({ length: 100 }, (_, index) => `team${index}`).join(
        ",",
      ),
      minPlayers: "100",
      maxPlayers: "100",
    },
  ])
    assert.ok("spec" in check(patch));
});

test("commands enforce byte limits, safe syntax and placeholder repetition scopes", () => {
  const check = (actions: Settings.SetupAction[]) =>
    buildTemplateSettings("minigames", "5", { ...newMinigameDraft(), actions });
  for (const command of [
    "",
    " ",
    "/say hello",
    " /say hello ",
    "one\ntwo",
    "one\rtwo",
    "one\ttwo",
    "one\0two",
    "one\u007ftwo",
    "\nsetup",
    "setup\n",
    "a".repeat(1025),
    "é".repeat(513),
    "say {unknown}",
    "say {}",
    "say {Team}",
    "say {matchid}",
    "say {",
    "say }",
    "say {team",
    "say team}",
    "say {{matchId}}",
    "say {matchId}}",
    "say {player}",
    "say {uuid}",
    "say {team}",
  ])
    assert.deepEqual(check([{ command }]), { error: "actions" }, command);
  for (const placeholder of ["player", "uuid"])
    assert.deepEqual(
      check([{ command: `join {${placeholder}}`, forEach: "team" }]),
      { error: "actions" },
    );
  assert.deepEqual(
    check([
      {
        command: "setup",
        forEach: "invalid" as Settings.SetupAction["forEach"],
      },
    ]),
    { error: "actions" },
  );
  assert.deepEqual(
    check(Array.from({ length: 101 }, () => ({ command: "setup" }))),
    { error: "actions" },
  );
  for (const actions of [
    [],
    Array.from({ length: 100 }, () => ({ command: "setup" })),
    [{ command: "a".repeat(1024) }],
    [{ command: "é".repeat(512) }],
    [{ command: " say {matchId} " }],
    [{ command: "assign {team} {matchId}", forEach: "team" as const }],
    [
      {
        command: "join {team} {player} {uuid} {matchId} {player}",
        forEach: "player" as const,
      },
    ],
  ])
    assert.ok("spec" in check(actions));
});

test("log patterns enforce byte and control limits without parsing Go regex syntax", () => {
  const check = (logPattern: string) =>
    buildTemplateSettings("minigames", "5", {
      ...newMinigameDraft(),
      logPattern,
    });
  for (const logPattern of [
    "a".repeat(513),
    "é".repeat(257),
    "end\n",
    "\rend",
    "end\tmatch",
    "end\0match",
    "end\u007fmatch",
  ])
    assert.deepEqual(check(logPattern), { error: "end" });
  for (const logPattern of [
    "a".repeat(512),
    "é".repeat(256),
    "(?i)game finished",
    "[",
    " ",
  ])
    assert.ok("spec" in check(logPattern));
});

test("setup actions move without mutation and cannot cross list boundaries", () => {
  const actions = [
    { command: "first" },
    { command: "second" },
    { command: "third" },
  ];
  assert.deepEqual(moveSetupAction(actions, 1, -1), [
    actions[1],
    actions[0],
    actions[2],
  ]);
  assert.deepEqual(moveSetupAction(actions, 1, 1), [
    actions[0],
    actions[2],
    actions[1],
  ]);
  assert.equal(moveSetupAction(actions, 0, -1), actions);
  assert.equal(moveSetupAction(actions, 2, 1), actions);
  assert.deepEqual(
    actions.map((action) => action.command),
    ["first", "second", "third"],
  );
});

test("both locales include matching minigame labels and validation messages", () => {
  const messages = ["en", "de"].map(
    (locale) =>
      JSON.parse(
        readFileSync(
          new URL(`../../../messages/${locale}.json`, import.meta.url),
          "utf8",
        ),
      ).NodeDetailsPage.minecraftTemplates,
  );
  for (const catalog of messages) {
    assert.equal("teamsOptional" in catalog.minigame, false);
    assert.equal("immediateIfZero" in catalog.minigame, false);
    for (const key of ["mode", "playerMode", "minigameMode"])
      assert.equal(typeof catalog[key], "string");
    for (const key of [
      "maxInstances",
      "numbers",
      "players",
      "teams",
      "capacity",
      "readyServers",
      "duration",
      "actions",
      "end",
    ])
      assert.equal(typeof catalog.minigame.errors[key], "string");
  }
  assert.deepEqual(
    Object.keys(messages[0].minigame).sort(),
    Object.keys(messages[1].minigame).sort(),
  );
  assert.deepEqual(
    Object.keys(messages[0].minigame.errors).sort(),
    Object.keys(messages[1].minigame.errors).sort(),
  );
});
