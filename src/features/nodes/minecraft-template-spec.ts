export type TemplateMode = "player" | "minigames";
export type SetupAction = { command: string; forEach?: "team" | "player" };
export type MinigameSpec = {
  lobbyMode?: "vestri" | "plugin";
  teams: string[];
  teamSize?: number;
  minPlayers: number;
  maxPlayers: number;
  joinTimeout: string;
  readyServers: number;
  lifecycle: {
    ready: { trigger: "serverLoad" | "explicit" };
    onAllJoined: SetupAction[];
    end: {
      logPattern?: string;
      whenEmpty: boolean;
      emptyGrace: string;
      returnPlayersTo: "lobby";
      deleteServer: true;
    };
  };
};
export type MinigameDraft = {
  lobbyMode?: "vestri" | "plugin";
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
export type TemplateValidationError =
  | "maxInstances"
  | "numbers"
  | "players"
  | "teams"
  | "capacity"
  | "readyServers"
  | "duration"
  | "actions"
  | "teamActions"
  | "end";

export function newMinigameDraft(): MinigameDraft {
  return {
    lobbyMode: "vestri",
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
  const teams = draft.teams
    .split(",")
    .map((team) => team.trim())
    .filter(Boolean);
  const teamSize = teams.length ? integer(draft.teamSize, 1) : undefined;
  const minPlayers = lobbyMode === "plugin" ? 1 : integer(draft.minPlayers, 1);
  const maxPlayers = integer(draft.maxPlayers, 1);
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
  if (teams.length && maxPlayers > teams.length * teamSize!)
    return { error: "capacity" };
  const readyServers = integer(draft.readyServers, 0);
  if (readyServers === undefined || readyServers > maxInstances)
    return { error: "readyServers" };
  const joinTimeout = integer(draft.joinTimeout, 1);
  const emptyGrace = integer(draft.emptyGrace, 1);
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
  const logPattern = draft.logPattern.trim();
  if (
    new TextEncoder().encode(logPattern).length > 512 ||
    hasControlCharacters(draft.logPattern) ||
    (!logPattern && !draft.whenEmpty)
  )
    return { error: "end" };

  return {
    spec: {
      maxInstances,
      mode: "minigames",
      minigame: {
        lobbyMode,
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
          end: {
            ...(logPattern ? { logPattern } : {}),
            whenEmpty: draft.whenEmpty,
            emptyGrace: `${emptyGrace}s`,
            returnPlayersTo: "lobby",
            deleteServer: true,
          },
        },
      },
    },
  };
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
