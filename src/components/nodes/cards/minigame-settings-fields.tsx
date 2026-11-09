"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  moveSetupAction,
  type MinigameDraft,
  type TeamCommand,
  type VariantDraft,
} from "@/features/nodes/minecraft-template-spec";

export function SettingChoice({
  label,
  value,
  onChange,
  options,
  empty,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string; disabled?: boolean }[];
  empty?: string;
}) {
  return (
    <label className="min-w-0 space-y-2 text-sm">
      <span>{label}</span>
      <Select
        value={value || "__empty"}
        onValueChange={(next) => onChange(next === "__empty" ? "" : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty" disabled={!empty}>
            {empty || label}
          </SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.id}
              value={option.id}
              disabled={option.disabled}
            >
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

type TeamDraft = Omit<VariantDraft, "name">;

export function TeamSettingsFields({
  value,
  inherited,
  pluginLobby,
  onChange,
}: {
  value: TeamDraft;
  inherited?: MinigameDraft;
  pluginLobby: boolean;
  onChange: (patch: TeamDraft) => void;
}) {
  const t = useTranslations("NodeDetailsPage.minecraftTemplates.minigame");
  const resolved = {
    ...inherited,
    ...Object.fromEntries(
      Object.entries(value).filter(
        ([key, entry]) => entry !== undefined &&
          (entry !== "" || key === "teams" || key === "remainderTeam"),
      ),
    ),
  };
  const teams = [
    ...new Set(
      (resolved.teams ?? "")
        .split(",")
        .map((team) => team.trim())
        .filter(Boolean),
    ),
  ];
  const roles = !pluginLobby && resolved.teamPolicy === "roles";
  const remainder = resolved.remainderTeam ?? "";
  const counts = resolved.teamCounts ?? {};
  const selectRemainder = (team: string) =>
    onChange({
      remainderTeam: team,
      teamCounts: {
        ...counts,
        ...(remainder ? { [remainder]: counts[remainder] || "0" } : {}),
        [team]: "",
      },
    });
  return (
    <div className="min-w-0 space-y-4">
      <label className="block min-w-0 space-y-2 text-sm">
        <span>{t("teams")}</span>
        <Input
          value={value.teams ?? ""}
          placeholder={
            inherited ? inherited.teams || t("noTeams") : t("teamsPlaceholder")
          }
          onChange={(event) =>
            onChange({
              teams: event.target.value || (inherited ? undefined : ""),
            })
          }
        />
      </label>
      {teams.length && !pluginLobby ? (
        <div title={t(roles ? "rolesHint" : "balancedHint")}>
          <SettingChoice
            label={t("teamPolicy")}
            value={value.teamPolicy ?? (inherited ? "" : "balanced")}
            empty={inherited ? t("inherit") : undefined}
            onChange={(policy) =>
              onChange({
                teamPolicy: (policy || undefined) as TeamDraft["teamPolicy"],
              })
            }
            options={[
              { id: "balanced", name: t("balanced") },
              { id: "roles", name: t("roles") },
            ]}
          />
        </div>
      ) : null}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {(["teamSize", "minPlayers", "maxPlayers"] as const)
          .filter(
            (key) =>
              (key !== "teamSize" || (teams.length > 0 && !roles)) &&
              (key !== "minPlayers" || !pluginLobby),
          )
          .map((key) => (
            <label key={key} className="min-w-0 space-y-2 text-sm">
              <span>{t(key)}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                required={!inherited}
                value={value[key] ?? ""}
                placeholder={inherited?.[key]}
                onChange={(event) =>
                  onChange({
                    [key]: event.target.value || (inherited ? undefined : ""),
                  })
                }
              />
            </label>
          ))}
      </div>
      {roles && teams.length ? (
        <fieldset className="min-w-0 space-y-3" title={t("rolesHint")}>
          <legend className="mb-2 text-sm font-medium">
            {t("roleQuotas")}
          </legend>
          <SettingChoice
            label={t("remainderTeam")}
            value={remainder}
            onChange={selectRemainder}
            options={teams.map((team) => ({ id: team, name: team }))}
          />
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <label key={team} className="min-w-0 space-y-2 text-sm">
                <span className="block wrap-anywhere">{team}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  aria-label={`${t("roleQuotas")}: ${team}`}
                  placeholder={team === remainder ? t("remainder") : "0"}
                  value={team === remainder ? "" : (counts[team] ?? "")}
                  onChange={(event) =>
                    event.target.value === ""
                      ? selectRemainder(team)
                      : onChange({
                          teamCounts: { ...counts, [team]: event.target.value },
                          ...(team === remainder ? { remainderTeam: "" } : {}),
                        })
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

export function CommandPhaseEditor({
  title,
  commands,
  teams,
  onChange,
}: {
  title: string;
  commands: TeamCommand[];
  teams?: string[];
  onChange: (commands: TeamCommand[]) => void;
}) {
  const t = useTranslations("NodeDetailsPage.minecraftTemplates.minigame");
  return (
    <fieldset className="min-w-0 space-y-3 border-t pt-3">
      <legend
        className="px-1 text-sm font-medium"
        title={t(teams ? "teamCommandsHint" : "startCommandsHint")}
      >
        {title}
      </legend>
      <ol className="min-w-0 divide-y">
        {commands.map((action, index) => (
          <li key={index} className="min-w-0 space-y-2 py-3 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">
                {t("commandNumber", { number: index + 1 })}
              </span>
              <div className="flex shrink-0 gap-1">
                {([-1, 1] as const).map((direction) => (
                  <Button
                    key={direction}
                    type="button"
                    size="icon"
                    variant="ghost"
                    title={t(direction === -1 ? "moveUp" : "moveDown")}
                    aria-label={t(direction === -1 ? "moveUp" : "moveDown")}
                    disabled={
                      direction === -1
                        ? index === 0
                        : index === commands.length - 1
                    }
                    onClick={() =>
                      onChange(moveSetupAction(commands, index, direction))
                    }
                  >
                    {direction === -1 ? <ArrowUp /> : <ArrowDown />}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  title={t("removeAction")}
                  aria-label={t("removeAction")}
                  onClick={() =>
                    onChange(
                      commands.filter((_, position) => position !== index),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            {teams ? (
              <SettingChoice
                label={t("commandTeam")}
                value={action.team}
                onChange={(team) =>
                  onChange(
                    commands.map((entry, position) =>
                      position === index ? { ...entry, team } : entry,
                    ),
                  )
                }
                options={[
                  ...new Set([...teams, ...(action.team ? [action.team] : [])]),
                ].map((team) => ({ id: team, name: team }))}
              />
            ) : null}
            <Input
              required
              aria-label={`${title}: ${t("commandNumber", { number: index + 1 })}`}
              value={action.command}
              title={t(teams ? "teamCommandsHint" : "startCommandsHint")}
              placeholder={
                teams ? "manhunt speedrunner add {player}" : "manhunt start"
              }
              onChange={(event) =>
                onChange(
                  commands.map((entry, position) =>
                    position === index
                      ? { ...entry, command: event.target.value }
                      : entry,
                  ),
                )
              }
            />
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        disabled={
          commands.length >= 100 || (teams !== undefined && !teams.length)
        }
        onClick={() =>
          onChange([...commands, { team: teams?.[0] ?? "", command: "" }])
        }
      >
        <Plus />
        {t("addAction")}
      </Button>
    </fieldset>
  );
}
