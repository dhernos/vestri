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
    loggerName: "GamePlugin",
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
        enabled: true,
        teamPolicy: "balanced",
        teamCounts: {},
        remainderTeam: "",
        lobbyMode: "vestri",
        instanceMode: "temporary",
        teams: ["red", "blue"],
        teamSize: 2,
        minPlayers: 2,
        maxPlayers: 4,
        joinTimeout: "20s",
        readyServers: 5,
        lifecycle: {
          ready: { trigger: "explicit" },
          teamCommands: [],
          startCommands: [],
          onAllJoined: [
            { command: "setup" },
            { command: "assign {team}", forEach: "team" },
            { command: "join {player}", forEach: "player" },
          ],
          end: {
            logPattern: "Game finished",
            loggerName: "GamePlugin",
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

test("default minigames are valid FFA and omit team size and an absent end pattern", () => {
  const result = buildTemplateSettings("minigames", "5", newMinigameDraft());
  assert.ok("spec" in result);
  assert.deepEqual(result.spec.minigame?.teams, []);
  assert.equal("teamSize" in result.spec.minigame!, false);
  assert.equal(result.spec.minigame?.lobbyMode, "vestri");
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
    [{ teams: "red, blue", teamSize: "0" }, "numbers"],
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
    [
      { teams: "", actions: [{ command: "assign", forEach: "team" }] },
      "teamActions",
    ],
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
    loggerName: "GamePlugin",
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
      teams: "red, blue",
      ...patch,
    });
  for (const teams of [
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
    buildTemplateSettings("minigames", "5", {
      ...newMinigameDraft(),
      teams: "red, blue",
      actions,
    });
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
      loggerName: "GamePlugin",
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
      "lobbyMode",
      "vestriLobby",
      "pluginLobby",
      "noTeams",
      "instanceMode",
      "temporary",
      "permanent",
      "minimumRunningServers",
      "minimumRunningServersHint",
    ])
      assert.equal(typeof catalog.minigame[key], "string");
    for (const key of [
      "maxInstances",
      "instanceMode",
      "numbers",
      "players",
      "teams",
      "capacity",
      "readyServers",
      "duration",
      "actions",
      "teamActions",
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

const buildMinigame = (patch: Partial<Settings.MinigameDraft>) =>
  buildTemplateSettings("minigames", "5", { ...newMinigameDraft(), ...patch });

test("edit hydration round-trips complete settings without mutating the source", () => {
  const built = buildMinigame({
    enabled: false,
    teams: "speedrunner,hunter",
    teamPolicy: "roles",
    teamCounts: { speedrunner: "2" },
    remainderTeam: "hunter",
    minPlayers: "3",
    maxPlayers: "12",
    logPattern: "^Game ended$",
    loggerName: "Manhunt",
    actions: [{ command: "setup" }],
    teamCommands: [
      { team: "speedrunner", command: "manhunt speedrunner add {player}" },
    ],
    startCommands: ["manhunt start {matchId}"],
    variants: [
      { name: "duo", teamCounts: { speedrunner: "1" }, maxPlayers: "8" },
    ],
  });
  assert.ok("spec" in built);
  const spec = built.spec.minigame!;
  const snapshot = structuredClone(spec);
  const draft = moduleExports.draftFromMinigame(spec);
  assert.deepEqual(buildMinigame(draft), built);
  draft.actions[0].command = "changed";
  draft.teamCommands![0].command = "changed";
  draft.teamCounts!.speedrunner = "5";
  assert.deepEqual(spec, snapshot);
  assert.deepEqual(moduleExports.pausedTemplateSettings(spec, 5), {
    minigame: { ...snapshot, enabled: false },
    maxInstances: 5,
  });
  assert.equal(
    moduleExports.draftFromMinigame({ ...spec, enabled: undefined }).enabled,
    true,
  );
});

test("role quotas require exactly one remainder and fit both player bounds", () => {
  const draft = {
    teams: "speedrunner,hunter",
    teamPolicy: "roles" as const,
    teamCounts: { speedrunner: "2" },
    remainderTeam: "hunter",
    minPlayers: "3",
    maxPlayers: "20",
    teamSize: "",
  };
  const result = buildMinigame(draft);
  assert.ok("spec" in result);
  assert.equal(result.spec.minigame?.teamSize, 20);
  assert.deepEqual(result.spec.minigame?.teamCounts, { speedrunner: 2 });
  const invalidQuotas: Partial<Settings.MinigameDraft>[] = [
    { remainderTeam: "" },
    { remainderTeam: "other" },
    { teams: "" },
    { teamCounts: {} },
    { teamCounts: { speedrunner: "4" } },
    { teamCounts: { speedrunner: "-1" } },
    { teamCounts: { speedrunner: "1.5" } },
  ];
  for (const patch of invalidQuotas)
    assert.deepEqual(buildMinigame({ ...draft, ...patch }), { error: "roles" });
});

test("new phases preserve order, validate teams/placeholders and retain hidden plugin drafts", () => {
  const draft = {
    ...newMinigameDraft(),
    teams: "red,blue",
    teamSize: "2",
    teamCommands: [
      { team: "red", command: "assign {player} {uuid} {team} {matchId}" },
    ],
    startCommands: ["first", "second {matchId}"],
  };
  const result = buildMinigame(draft);
  assert.ok("spec" in result);
  assert.deepEqual(
    result.spec.minigame?.lifecycle.startCommands,
    draft.startCommands,
  );
  for (const patch of [
    { teamCommands: [{ team: "missing", command: "assign" }] },
    { teamCommands: [{ team: "red", command: "/assign {player}" }] },
    { startCommands: ["start {player}"] },
    { startCommands: ["start\nnow"] },
  ])
    assert.deepEqual(buildMinigame({ ...draft, ...patch }), {
      error: "actions",
    });
  const native = buildMinigame({ ...draft, lobbyMode: "plugin" });
  assert.ok("spec" in native);
  assert.deepEqual(native.spec.minigame?.lifecycle.teamCommands, []);
  assert.deepEqual(native.spec.minigame?.lifecycle.startCommands, []);
  assert.deepEqual(buildMinigame(draft), result);
});

test("variants validate inherited settings, identifiers, quotas and the 20-entry limit", () => {
  const result = buildMinigame({
    variants: [
      { name: "2v2", teams: "red,blue", teamSize: "2", maxPlayers: "4" },
      {
        name: "4v4v4v4",
        teams: "red,blue,green,yellow",
        teamSize: "4",
        maxPlayers: "16",
      },
    ],
  });
  assert.ok("spec" in result);
  assert.deepEqual(result.spec.minigame?.variants?.["2v2"], {
    teams: ["red", "blue"],
    teamSize: 2,
    maxPlayers: 4,
  });
  for (const variants of [
    [{ name: "" }],
    [{ name: "bad name" }],
    [{ name: "same" }, { name: "same" }],
    [{ name: "invalid", maxPlayers: "0" }],
    [{ name: "invalid", teams: "red", teamSize: "1", maxPlayers: "4" }],
    Array.from({ length: 21 }, (_, index) => ({ name: `v${index}` })),
    [
      {
        name: "roles",
        teams: "runner,hunter",
        teamPolicy: "roles" as const,
        remainderTeam: "hunter",
        teamCounts: { runner: "3" },
      },
    ],
  ])
    assert.deepEqual(buildMinigame({ variants }), { error: "variants" });
});

test("log regex requires an exact logger on create and hydrated legacy edits", () => {
  assert.deepEqual(buildMinigame({ logPattern: "^Game ended$" }), {
    error: "loggerName",
  });
  for (const loggerName of [
    "",
    " ",
    "plugin\n",
    "a".repeat(129),
    " Game",
    "Game ",
    "-Game",
    "Game Plugin",
    "Pl\u00fcgin",
    "Game/logger",
  ])
    assert.deepEqual(
      buildMinigame({ logPattern: "^Game ended$", loggerName }),
      { error: "loggerName" },
    );
  const valid = buildMinigame({
    logPattern: "^Game ended$",
    loggerName: "Manhunt",
  });
  assert.ok("spec" in valid);
  const legacy = structuredClone(valid.spec.minigame!);
  delete legacy.lifecycle.end.loggerName;
  assert.deepEqual(buildMinigame(moduleExports.draftFromMinigame(legacy)), {
    error: "loggerName",
  });
});

test("plugin lobby serializes balanced native teams without mutating retained roles", () => {
  const draft = {
    ...newMinigameDraft(),
    teams: "runner,hunter",
    teamSize: "4",
    teamPolicy: "roles" as const,
    teamCounts: { runner: "1" },
    remainderTeam: "hunter",
    maxPlayers: "8",
    variants: [
      {
        name: "duo",
        teamPolicy: "roles" as const,
        teamCounts: { runner: "2" },
      },
    ],
  };
  const managed = buildMinigame(draft);
  assert.ok("spec" in managed);
  const native = buildMinigame({ ...draft, lobbyMode: "plugin" });
  assert.ok("spec" in native);
  assert.equal(native.spec.minigame!.teamPolicy, "balanced");
  assert.equal(native.spec.minigame!.teamSize, 4);
  assert.deepEqual(native.spec.minigame!.teamCounts, {});
  assert.equal(native.spec.minigame!.remainderTeam, "");
  assert.deepEqual(native.spec.minigame!.variants!.duo, {
    teamPolicy: "balanced",
    teamCounts: {},
    remainderTeam: "",
  });
  assert.deepEqual(buildMinigame(draft), managed);
  assert.deepEqual(
    buildMinigame({ ...draft, lobbyMode: "plugin", teamSize: "1" }),
    { error: "capacity" },
  );
});

test("all lifecycle phases share the 100-command budget and generic syntax rules", () => {
  const draft = {
    teams: "red,blue",
    teamSize: "2",
    actions: Array.from({ length: 98 }, () => ({ command: "setup" })),
    teamCommands: [{ team: "red", command: "assign {player}" }],
    startCommands: ["start"],
  };
  assert.ok("spec" in buildMinigame(draft));
  assert.deepEqual(
    buildMinigame({ ...draft, startCommands: ["start", "extra"] }),
    { error: "actions" },
  );
  for (const command of [
    "/assign",
    "assign\nnow",
    "x".repeat(1025),
    "assign {unknown}",
    "assign {",
  ])
    for (const phase of ["teamCommands", "startCommands"] as const)
      assert.deepEqual(
        buildMinigame({
          teams: "red,blue",
          [phase]:
            phase === "teamCommands" ? [{ team: "red", command }] : [command],
        }),
        { error: "actions" },
      );
});

test("variants validate inherited command teams and allow generic player setup", () => {
  const draft = {
    teams: "red,blue,green,yellow",
    teamSize: "2",
    maxPlayers: "4",
    teamCommands: [{ team: "red", command: "assign {player}" }],
    variants: [{ name: "duel", teams: "green,yellow" }],
  };
  assert.deepEqual(buildMinigame(draft), { error: "variantTeamCommands" });
  assert.ok(
    "spec" in
      buildMinigame({
        ...draft,
        variants: [{ name: "duel", teams: "red,blue" }],
      }),
  );
  assert.ok(
    "spec" in
      buildMinigame({
        ...draft,
        teamCommands: [],
        actions: [{ command: "assign {player} {team}", forEach: "player" }],
      }),
  );
});

test("hydration preserves explicit FFA and balanced variant resets", () => {
  const built = buildMinigame({
    teams: "runner,hunter",
    teamPolicy: "roles",
    teamCounts: { runner: "1" },
    remainderTeam: "hunter",
    maxPlayers: "4",
    variants: [
      {
        name: "ffa",
        teams: "",
        teamPolicy: "balanced",
        teamCounts: {},
        remainderTeam: "",
      },
    ],
  });
  assert.ok("spec" in built);
  assert.deepEqual(built.spec.minigame!.variants!.ffa, {
    teams: [],
    teamSize: 0,
    teamPolicy: "balanced",
    teamCounts: {},
    remainderTeam: "",
  });
  assert.deepEqual(
    buildMinigame(moduleExports.draftFromMinigame(built.spec.minigame!)),
    built,
  );
  for (const loggerName of ["Game.Plugin_logger-1:main", "a".repeat(128)])
    assert.ok("spec" in buildMinigame({ logPattern: "finished", loggerName }));
});

test("missing lobby mode defaults to Vestri matchmaking", () => {
  const result = buildMinigame({ lobbyMode: undefined });
  assert.ok("spec" in result);
  assert.equal(result.spec.minigame?.lobbyMode, "vestri");
});

test("empty and separator-only teams serialize as FFA without capacity checks", () => {
  for (const teams of ["", " , , "]) {
    const result = buildMinigame({ teams, maxPlayers: "100" });
    assert.ok("spec" in result);
    assert.deepEqual(result.spec.minigame?.teams, []);
    assert.equal("teamSize" in result.spec.minigame!, false);
  }
});

test("FFA ignores hidden blank, zero and stale team sizes", () => {
  for (const teamSize of ["", "0", "101", "invalid"])
    assert.ok("spec" in buildMinigame({ teamSize }));
});

test("FFA still enforces Vestri minimum and maximum player limits", () => {
  assert.deepEqual(buildMinigame({ minPlayers: "3" }), { error: "players" });
  assert.deepEqual(buildMinigame({ maxPlayers: "101" }), { error: "numbers" });
});

test("FFA rejects per-team repetition even without placeholders", () => {
  assert.deepEqual(
    buildMinigame({ actions: [{ command: "setup", forEach: "team" }] }),
    { error: "teamActions" },
  );
});

test("FFA rejects team placeholders for once and per-player commands", () => {
  for (const forEach of [undefined, "player"] as const)
    assert.deepEqual(
      buildMinigame({ actions: [{ command: "assign {team}", forEach }] }),
      { error: "teamActions" },
    );
});

test("FFA supports once and per-player commands without team placeholders", () => {
  assert.ok(
    "spec" in
      buildMinigame({
        actions: [
          { command: "setup {matchId}" },
          { command: "join {player} {uuid}", forEach: "player" },
        ],
      }),
  );
});

test("nonempty teams retain capacity and identifier constraints", () => {
  assert.deepEqual(buildMinigame({ teams: "red" }), { error: "capacity" });
  assert.deepEqual(buildMinigame({ teams: "red,red" }), { error: "teams" });
  assert.deepEqual(buildMinigame({ teams: "_red,blue" }), { error: "teams" });
});

test("nonempty teams allow team placeholders in team and player scopes", () => {
  for (const forEach of ["team", "player"] as const)
    assert.ok(
      "spec" in
        buildMinigame({
          teams: "red,blue",
          actions: [{ command: "assign {team}", forEach }],
        }),
    );
});

test("plugin lobby bypasses retained invalid or high minimums and sends one", () => {
  for (const minPlayers of ["", "0", "101", "90", "invalid"]) {
    const result = buildMinigame({ lobbyMode: "plugin", minPlayers });
    assert.ok("spec" in result);
    assert.equal(result.spec.minigame?.minPlayers, 1);
    assert.equal(result.spec.minigame?.lobbyMode, "plugin");
  }
});

test("plugin lobby ignores stale startup syntax, team scopes and action count", () => {
  const result = buildMinigame({
    lobbyMode: "plugin",
    actions: Array.from({ length: 101 }, () => ({
      command: "/bad {team}",
      forEach: "team" as const,
    })),
  });
  assert.ok("spec" in result);
  assert.deepEqual(result.spec.minigame?.lifecycle.onAllJoined, []);
});

test("plugin lobby preserves team capacity, maximum and duration validation", () => {
  for (const [patch, error] of [
    [{ teams: "red" }, "capacity"],
    [{ maxPlayers: "0" }, "numbers"],
    [{ emptyGrace: "0" }, "duration"],
    [{ emptyGrace: "601" }, "duration"],
  ] as const)
    assert.deepEqual(buildMinigame({ lobbyMode: "plugin", ...patch }), {
      error,
    });
});

test("switching lobby mode preserves actions, order, scope and minimum", () => {
  const draft = {
    ...newMinigameDraft(),
    minPlayers: "2",
    actions: [
      { command: " setup " },
      { command: "join {player}", forEach: "player" as const },
    ],
  };
  const before = structuredClone(draft);
  const native = buildTemplateSettings("minigames", "5", {
    ...draft,
    lobbyMode: "plugin",
  });
  assert.ok("spec" in native);
  assert.deepEqual(native.spec.minigame?.lifecycle.onAllJoined, []);
  assert.deepEqual(draft, before);
  const restored = buildTemplateSettings("minigames", "5", {
    ...draft,
    lobbyMode: "vestri",
  });
  assert.ok("spec" in restored);
  assert.equal(restored.spec.minigame?.minPlayers, 2);
  assert.deepEqual(restored.spec.minigame?.lifecycle.onAllJoined, [
    { command: "setup" },
    draft.actions[1],
  ]);
});

test("removing and restoring teams surfaces stale scopes without mutating actions", () => {
  const draft = {
    ...newMinigameDraft(),
    actions: [{ command: "assign {team}", forEach: "team" as const }],
  };
  assert.deepEqual(buildMinigame(draft), { error: "teamActions" });
  assert.ok("spec" in buildMinigame({ ...draft, lobbyMode: "plugin" }));
  assert.ok("spec" in buildMinigame({ ...draft, teams: "red,blue" }));
  assert.equal(draft.actions[0].forEach, "team");
});

test("legacy lifetime defaults to temporary for FFA and plugin lobbies", () => {
  for (const lobbyMode of [undefined, "vestri", "plugin"] as const) {
    const result = buildMinigame({ lobbyMode, instanceMode: undefined });
    assert.ok("spec" in result);
    assert.equal(result.spec.minigame?.instanceMode, "temporary");
    assert.equal(result.spec.minigame?.lifecycle.end.deleteServer, true);
    assert.equal(result.spec.minigame?.lifecycle.end.whenEmpty, true);
  }
});

test("permanent instances require an explicit plugin lobby", () => {
  for (const lobbyMode of [undefined, "vestri"] as const)
    assert.deepEqual(buildMinigame({ instanceMode: "permanent", lobbyMode }), {
      error: "instanceMode",
    });
  assert.deepEqual(
    buildMinigame({
      instanceMode: "invalid" as Settings.MinigameDraft["instanceMode"],
    }),
    { error: "instanceMode" },
  );
});

test("permanent FFA ignores all hidden termination settings and supports on-demand instances", () => {
  const result = buildMinigame({
    instanceMode: "permanent",
    lobbyMode: "plugin",
    minPlayers: "invalid",
    teamSize: "invalid",
    actions: [{ command: "/bad {team}" }],
    logPattern: "bad\n" + "a".repeat(513),
    whenEmpty: false,
    emptyGrace: "invalid",
    readyServers: "0",
  });
  assert.ok("spec" in result);
  assert.equal(result.spec.minigame?.instanceMode, "permanent");
  assert.equal(result.spec.minigame?.readyServers, 0);
  assert.deepEqual(result.spec.minigame?.lifecycle.end, {
    whenEmpty: false,
    emptyGrace: "10s",
    returnPlayersTo: "lobby",
    deleteServer: false,
  });
  assert.deepEqual(result.spec.minigame?.lifecycle.onAllJoined, []);
});

test("permanent player, team, minimum running server and timeout constraints remain", () => {
  for (const [patch, error] of [
    [{ maxPlayers: "0" }, "numbers"],
    [{ maxPlayers: "101" }, "numbers"],
    [{ maxPlayers: "1.5" }, "numbers"],
    [{ teams: "red", teamSize: "0" }, "numbers"],
    [{ teams: "red" }, "capacity"],
    [{ teams: "red,red" }, "teams"],
    [{ readyServers: "6" }, "readyServers"],
    [{ readyServers: "-1" }, "readyServers"],
    [{ readyServers: "1.5" }, "readyServers"],
    [{ joinTimeout: "601" }, "duration"],
  ] as const)
    assert.deepEqual(
      buildMinigame({
        lobbyMode: "plugin",
        instanceMode: "permanent",
        ...patch,
      }),
      { error },
    );
  assert.ok(
    "spec" in
      buildMinigame({
        lobbyMode: "plugin",
        instanceMode: "permanent",
        teams: "red,blue",
        readyServers: "5",
      }),
  );
});

test("lifetime switching retains hidden draft settings and restores temporary payloads", () => {
  const draft = {
    ...newMinigameDraft(),
    lobbyMode: "plugin" as const,
    logPattern: " Finished ",
    whenEmpty: true,
    emptyGrace: "42",
    minPlayers: "7",
    actions: [{ command: " setup " }],
  };
  const before = structuredClone(draft);
  const temporary = buildMinigame(draft);
  const permanent = buildMinigame({ ...draft, instanceMode: "permanent" });
  assert.ok("spec" in permanent);
  assert.equal(permanent.spec.minigame?.lifecycle.end.whenEmpty, false);
  assert.deepEqual(draft, before);
  assert.deepEqual(
    buildMinigame({ ...draft, instanceMode: "temporary" }),
    temporary,
  );
  assert.deepEqual(buildMinigame({ ...draft, emptyGrace: "invalid" }), {
    error: "duration",
  });
  assert.deepEqual(
    buildMinigame({ ...draft, whenEmpty: false, logPattern: "" }),
    { error: "end" },
  );
  assert.deepEqual(
    buildTemplateSettings("player", "5", {
      ...draft,
      instanceMode: "permanent",
      lobbyMode: "vestri",
      readyServers: "invalid",
    }),
    { spec: { maxInstances: 5 } },
  );
});
