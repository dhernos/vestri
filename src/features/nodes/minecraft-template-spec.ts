export type TemplateMode = "player" | "minigames";
export type SetupAction = { command: string; forEach?: "team" | "player" };
export type TeamCommand = { team: string; command: string };
export type TeamSettings = {
  teams: string[];
  teamSize?: number;
  minPlayers: number;
  maxPlayers: number;
  teamPolicy?: "balanced" | "roles";
  teamCounts?: Record<string, number>;
  remainderTeam?: string;
};
export type MinigameSpec = {
  enabled?: boolean;
  teamPolicy?: "balanced" | "roles";
  teamCounts?: Record<string, number>;
  remainderTeam?: string;
  variants?: Record<string, Partial<TeamSettings>>;
  lobbyMode?: "vestri" | "plugin";
  instanceMode?: "temporary" | "permanent";
  teams: string[];
  teamSize?: number;
  minPlayers: number;
  maxPlayers: number;
  joinTimeout: string;
  readyServers: number;
  lifecycle: {
    ready: { trigger: "serverLoad" | "explicit" };
    onAllJoined: SetupAction[];
    teamCommands?: TeamCommand[];
    startCommands?: string[];
    end: {
      logPattern?: string;
      loggerName?: string;
      whenEmpty: boolean;
      emptyGrace: string;
      returnPlayersTo: "lobby";
      deleteServer: boolean;
    };
  };
};
export type MinigameDraft = {
  enabled?: boolean;
  teamPolicy?: "balanced" | "roles";
  teamCounts?: Record<string, string>;
  remainderTeam?: string;
  variants?: VariantDraft[];
  teamCommands?: TeamCommand[];
  startCommands?: string[];
  loggerName?: string;
  lobbyMode?: "vestri" | "plugin";
  instanceMode?: "temporary" | "permanent";
  teams: string;
  teamSize: string;
  minPlayers: string;
  maxPlayers: string;
  joinTimeout: string;
  readyServers: string;
  readyTrigger: "serverLoad" | "explicit";
  actions: SetupAction[];
  logPattern: string;
  whenEmpty: boolean;
  emptyGrace: string;
};
export type VariantDraft = {
  name: string;
  teams?: string;
  teamSize?: string;
  minPlayers?: string;
  maxPlayers?: string;
  teamPolicy?: "balanced" | "roles";
  teamCounts?: Record<string, string>;
  remainderTeam?: string;
};
export type TemplateValidationError =
  | "maxInstances"
  | "instanceMode"
  | "numbers"
  | "players"
  | "teams"
  | "capacity"
  | "readyServers"
  | "duration"
  | "actions"
  | "teamActions"
  | "roles"
  | "variants"
  | "variantTeamCommands"
  | "loggerName"
  | "end";

export function newMinigameDraft(): MinigameDraft {
  return {
    enabled: true,
    teamPolicy: "balanced",
    teamCounts: {},
    remainderTeam: "",
    variants: [],
    teamCommands: [],
    startCommands: [],
    loggerName: "",
    lobbyMode: "vestri",
    instanceMode: "temporary",
    teams: "",
    teamSize: "1",
    minPlayers: "2",
    maxPlayers: "2",
    joinTimeout: "20",
    readyServers: "0",
    readyTrigger: "serverLoad",
    actions: [],
    logPattern: "",
    whenEmpty: true,
    emptyGrace: "10",
  };
}

function integer(value: string, minimum: number) {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum ? number : undefined;
}

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function validSetupAction(action: SetupAction) {
  const command = action.command.trim();
  if (
    !command ||
    new TextEncoder().encode(command).length > 1024 ||
    command.startsWith("/") ||
    hasControlCharacters(action.command) ||
    (action.forEach !== undefined &&
      action.forEach !== "team" &&
      action.forEach !== "player")
  )
    return false;
  let valid = true;
  const remainder = command.replace(
    /\{([^{}]*)\}/g,
    (_, placeholder: string) => {
      if (
        !["team", "player", "uuid", "matchId"].includes(placeholder) ||
        ((placeholder === "player" || placeholder === "uuid") &&
          action.forEach !== "player") ||
        (placeholder === "team" &&
          action.forEach !== "team" &&
          action.forEach !== "player")
      )
        valid = false;
      return "";
    },
  );
  return valid && !/[{}]/.test(remainder);
}

export function buildTemplateSettings(
  mode: TemplateMode,
  maxInstancesInput: string,
  draft: MinigameDraft,
):
  | { error: TemplateValidationError }
  | {
      spec: {
        maxInstances: number;
        mode?: TemplateMode;
        minigame?: MinigameSpec;
      };
    } {
  const maxInstances = integer(maxInstancesInput, 1);
  if (maxInstances === undefined || maxInstances > 100)
    return { error: "maxInstances" };
  if (mode === "player") return { spec: { maxInstances } };

  const lobbyMode = draft.lobbyMode ?? "vestri";
  const instanceMode = draft.instanceMode ?? "temporary";
  const permanent = instanceMode === "permanent";
  if (
    !["temporary", "permanent"].includes(instanceMode) ||
    (permanent && lobbyMode !== "plugin")
  )
    return { error: "instanceMode" };
  const teams = draft.teams
    .split(",")
    .map((team) => team.trim())
    .filter(Boolean);
  const teamPolicy =
    lobbyMode === "plugin" ? "balanced" : (draft.teamPolicy ?? "balanced");
  const minPlayers = lobbyMode === "plugin" ? 1 : integer(draft.minPlayers, 1);
  const maxPlayers = integer(draft.maxPlayers, 1);
  const teamSize = teams.length
    ? teamPolicy === "roles"
      ? maxPlayers
      : integer(draft.teamSize, 1)
    : undefined;
  if (
    (teams.length > 0 && (teamSize === undefined || teamSize > 100)) ||
    minPlayers === undefined ||
    maxPlayers === undefined ||
    minPlayers > 100 ||
    maxPlayers > 100
  )
    return { error: "numbers" };
  if (minPlayers > maxPlayers) return { error: "players" };
  if (
    teams.length > 100 ||
    new Set(teams).size !== teams.length ||
    teams.some((team) => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(team))
  )
    return { error: "teams" };
  if (teamPolicy !== "balanced" && teamPolicy !== "roles")
    return { error: "roles" };
  if (
    teamPolicy === "balanced" &&
    teams.length &&
    maxPlayers > teams.length * teamSize!
  )
    return { error: "capacity" };
  const teamCounts: Record<string, number> = {};
  if (teamPolicy === "roles") {
    if (!teams.length || !teams.includes(draft.remainderTeam ?? ""))
      return { error: "roles" };
    for (const team of teams.filter((team) => team !== draft.remainderTeam)) {
      const count = integer(draft.teamCounts?.[team] ?? "", 0);
      if (count === undefined || count > 100) return { error: "roles" };
      teamCounts[team] = count;
    }
    if (
      Object.values(teamCounts).reduce((sum, count) => sum + count, 0) >
      minPlayers
    )
      return { error: "roles" };
  }
  const readyServers = integer(draft.readyServers, 0);
  if (readyServers === undefined || readyServers > maxInstances)
    return { error: "readyServers" };
  const joinTimeout = integer(draft.joinTimeout, 1);
  const emptyGrace = permanent ? 10 : integer(draft.emptyGrace, 1);
  if (
    joinTimeout === undefined ||
    emptyGrace === undefined ||
    joinTimeout > 600 ||
    emptyGrace > 600
  )
    return { error: "duration" };
  const actions = lobbyMode === "plugin" ? [] : draft.actions;
  if (
    !teams.length &&
    actions.some(
      (action) =>
        action.forEach === "team" || action.command.includes("{team}"),
    )
  )
    return { error: "teamActions" };
  if (
    actions.length > 100 ||
    actions.some((action) => !validSetupAction(action))
  )
    return { error: "actions" };
  const teamCommands = lobbyMode === "plugin" ? [] : (draft.teamCommands ?? []);
  const startCommands =
    lobbyMode === "plugin" ? [] : (draft.startCommands ?? []);
  if (
    actions.length + teamCommands.length + startCommands.length > 100 ||
    teamCommands.some(
      (action) =>
        !teams.includes(action.team) ||
        !validSetupAction({ command: action.command, forEach: "player" }),
    ) ||
    startCommands.some((command) => !validSetupAction({ command }))
  )
    return { error: "actions" };
  const logPattern = permanent ? "" : draft.logPattern.trim();
  if (
    !permanent &&
    (new TextEncoder().encode(logPattern).length > 512 ||
      hasControlCharacters(draft.logPattern) ||
      (!logPattern && !draft.whenEmpty))
  )
    return { error: "end" };
  const loggerName = permanent ? "" : (draft.loggerName ?? "");
  if (logPattern && !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(loggerName))
    return { error: "loggerName" };

  const variants: Record<string, Partial<TeamSettings>> = {};
  if ((draft.variants?.length ?? 0) > 20) return { error: "variants" };
  for (const variant of draft.variants ?? []) {
    const name = variant.name.trim();
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name) ||
      Object.hasOwn(variants, name)
    )
      return { error: "variants" };
    const overrides = Object.fromEntries(
      Object.entries(variant).filter(
        ([key, value]) =>
          key !== "name" &&
          value !== undefined &&
          (value !== "" || key === "teams" || key === "remainderTeam"),
      ),
    );
    const variantTeams = String(overrides.teams ?? draft.teams)
      .split(",")
      .map((team) => team.trim())
      .filter(Boolean);
    if (teamCommands.some((action) => !variantTeams.includes(action.team)))
      return { error: "variantTeamCommands" };
    const resolved = buildTemplateSettings("minigames", maxInstancesInput, {
      ...draft,
      ...overrides,
      variants: [],
    });
    if ("error" in resolved) return { error: "variants" };
    const settings = resolved.spec.minigame!;
    const override: Partial<TeamSettings> = {};
    for (const key of [
      "teams",
      "teamSize",
      "minPlayers",
      "maxPlayers",
      "teamPolicy",
      "teamCounts",
      "remainderTeam",
    ] as const) {
      if (Object.hasOwn(overrides, key) && settings[key] !== undefined)
        Object.assign(override, { [key]: settings[key] });
    }
    if (settings.teamPolicy === "roles")
      override.teamSize = settings.maxPlayers;
    if (override.teamPolicy === "balanced") {
      override.teamCounts = {};
      override.remainderTeam = "";
    }
    if (override.teams?.length === 0) override.teamSize = 0;
    Object.defineProperty(variants, name, {
      value: override,
      enumerable: true,
    });
  }

  return {
    spec: {
      maxInstances,
      mode: "minigames",
      minigame: {
        enabled: draft.enabled ?? true,
        teamPolicy,
        teamCounts,
        remainderTeam: teamPolicy === "roles" ? draft.remainderTeam : "",
        ...(Object.keys(variants).length ? { variants } : {}),
        lobbyMode,
        instanceMode,
        teams,
        ...(teams.length ? { teamSize } : {}),
        minPlayers,
        maxPlayers,
        joinTimeout: `${joinTimeout}s`,
        readyServers,
        lifecycle: {
          ready: { trigger: draft.readyTrigger },
          onAllJoined: actions.map((action) => ({
            command: action.command.trim(),
            ...(action.forEach ? { forEach: action.forEach } : {}),
          })),
          teamCommands: teamCommands.map(({ team, command }) => ({
            team,
            command: command.trim(),
          })),
          startCommands: startCommands.map((command) => command.trim()),
          end: {
            ...(logPattern ? { logPattern } : {}),
            ...(logPattern ? { loggerName } : {}),
            whenEmpty: permanent ? false : draft.whenEmpty,
            emptyGrace: `${emptyGrace}s`,
            returnPlayersTo: "lobby",
            deleteServer: !permanent,
          },
        },
      },
    },
  };
}

function seconds(duration: string) {
  const parts = [...duration.matchAll(/([\d.]+)(ms|h|m|s)/g)];
  return String(
    parts.reduce(
      (total, part) =>
        total +
        Number(part[1]) * ({ ms: 0.001, h: 3600, m: 60, s: 1 }[part[2]] ?? 0),
      0,
    ),
  );
}

export function draftFromMinigame(spec: MinigameSpec): MinigameDraft {
  return {
    ...newMinigameDraft(),
    enabled: spec.enabled ?? true,
    lobbyMode: spec.lobbyMode ?? "vestri",
    instanceMode: spec.instanceMode ?? "temporary",
    teams: (spec.teams ?? []).join(", "),
    teamSize: String(spec.teamSize ?? 1),
    minPlayers: String(spec.minPlayers),
    maxPlayers: String(spec.maxPlayers),
    teamPolicy: spec.teamPolicy ?? "balanced",
    teamCounts: Object.fromEntries(
      Object.entries(spec.teamCounts ?? {}).map(([team, count]) => [
        team,
        String(count),
      ]),
    ),
    remainderTeam: spec.remainderTeam ?? "",
    variants: Object.entries(spec.variants ?? {}).map(([name, variant]) => ({
      name,
      ...variant,
      teams: variant.teams?.join(", "),
      teamSize:
        variant.teamSize === undefined ? undefined : String(variant.teamSize),
      minPlayers:
        variant.minPlayers === undefined
          ? undefined
          : String(variant.minPlayers),
      maxPlayers:
        variant.maxPlayers === undefined
          ? undefined
          : String(variant.maxPlayers),
      teamCounts:
        variant.teamCounts &&
        Object.fromEntries(
          Object.entries(variant.teamCounts).map(([team, count]) => [
            team,
            String(count),
          ]),
        ),
    })),
    joinTimeout: seconds(spec.joinTimeout),
    readyServers: String(spec.readyServers),
    readyTrigger: spec.lifecycle.ready.trigger,
    actions: spec.lifecycle.onAllJoined.map((action) => ({ ...action })),
    teamCommands: (spec.lifecycle.teamCommands ?? []).map((action) => ({
      ...action,
    })),
    startCommands: [...(spec.lifecycle.startCommands ?? [])],
    logPattern: spec.lifecycle.end.logPattern ?? "",
    loggerName: spec.lifecycle.end.loggerName ?? "",
    whenEmpty: spec.lifecycle.end.whenEmpty,
    emptyGrace: seconds(spec.lifecycle.end.emptyGrace),
  };
}

export function pausedTemplateSettings(
  minigame: MinigameSpec,
  maxInstances: number,
) {
  return { minigame: { ...minigame, enabled: false }, maxInstances };
}

export function moveSetupAction<Action>(
  actions: Action[],
  index: number,
  direction: -1 | 1,
): Action[] {
  const target = index + direction;
  if (
    index < 0 ||
    index >= actions.length ||
    target < 0 ||
    target >= actions.length
  )
    return actions;
  const next = [...actions];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
