import type { ConfigRow } from "@/features/servers/types";

type EnvStyle = "map" | "list";

type ServiceBlock = {
  name: string;
  start: number;
  end: number;
  indent: number;
  envStart: number;
  envEnd: number;
  envIndent: number;
  envStyle: EnvStyle;
};

type ComposeEnvEntry = {
  key: string;
  value: string;
};

const countLeadingSpaces = (line: string) => {
  let count = 0;
  while (count < line.length && line[count] === " ") {
    count += 1;
  }
  return count;
};

const isBlankOrComment = (line: string) => {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
};

const matchBareYamlKey = (line: string) => {
  const trimmed = line.trim();
  const match = /^([A-Za-z0-9_.-]+):\s*(?:#.*)?$/.exec(trimmed);
  return match?.[1] || "";
};

const normalizeContent = (content: string) =>
  content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

const stripWrappedQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseServiceBlocks = (content: string) => {
  const lines = normalizeContent(content).split("\n");

  let servicesIndex = -1;
  let servicesIndent = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/^services:\s*(?:#.*)?$/.test(line)) {
      servicesIndex = i;
      servicesIndent = countLeadingSpaces(lines[i]);
      break;
    }
  }

  if (servicesIndex < 0) {
    return { lines, blocks: [] as ServiceBlock[] };
  }

  const blocks: ServiceBlock[] = [];
  let current: ServiceBlock | null = null;

  for (let i = servicesIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const indent = countLeadingSpaces(line);

    if (!isBlankOrComment(line) && indent <= servicesIndent) {
      if (current) {
        current.end = i;
        blocks.push(current);
        current = null;
      }
      break;
    }

    const serviceName = indent === servicesIndent + 2 ? matchBareYamlKey(line) : "";
    if (serviceName) {
      if (current) {
        current.end = i;
        blocks.push(current);
      }
      current = {
        name: serviceName,
        start: i,
        end: lines.length,
        indent,
        envStart: -1,
        envEnd: -1,
        envIndent: indent + 2,
        envStyle: "map",
      };
      continue;
    }
  }

  if (current) {
    current.end = lines.length;
    blocks.push(current);
  }

  for (const block of blocks) {
    for (let i = block.start + 1; i < block.end; i += 1) {
      const line = lines[i];
      if (isBlankOrComment(line)) {
        continue;
      }

      const indent = countLeadingSpaces(line);
      const trimmed = line.trim();
      if (
        indent === block.indent + 2 &&
        /^environment:\s*(?:#.*)?$/.test(trimmed)
      ) {
        block.envStart = i;
        block.envIndent = indent;
        block.envEnd = block.end;

        for (let j = i + 1; j < block.end; j += 1) {
          const envLine = lines[j];
          if (isBlankOrComment(envLine)) {
            continue;
          }
          const envIndent = countLeadingSpaces(envLine);
          if (envIndent <= indent) {
            block.envEnd = j;
            break;
          }
          block.envStyle = envLine.trim().startsWith("- ") ? "list" : "map";
        }
        break;
      }
    }
  }

  return { lines, blocks };
};

const parseMapStyleEnvEntry = (line: string) => {
  const idx = line.indexOf(":");
  if (idx < 0) {
    return null;
  }
  const key = stripWrappedQuotes(line.slice(0, idx));
  if (!key) {
    return null;
  }
  const value = line.slice(idx + 1).trim();
  return { key, value };
};

const parseListStyleEnvEntry = (line: string) => {
  const idx = line.indexOf("=");
  if (idx < 0) {
    const key = stripWrappedQuotes(line);
    if (!key) {
      return null;
    }
    return { key, value: "" };
  }
  const key = stripWrappedQuotes(line.slice(0, idx));
  if (!key) {
    return null;
  }
  const value = line.slice(idx + 1).trim();
  return { key, value };
};

const parseScopedEnvKey = (rawKey: string, defaultService: string) => {
  const key = rawKey.trim();
  if (!key) {
    return null;
  }

  const dotIndex = key.indexOf(".");
  if (dotIndex < 0) {
    if (!defaultService) {
      return null;
    }
    return { service: defaultService, key };
  }

  const service = key.slice(0, dotIndex).trim();
  const envKey = key.slice(dotIndex + 1).trim();
  if (!service || !envKey) {
    return null;
  }
  return { service, key: envKey };
};

const renderEnvironmentBlock = (
  envIndent: number,
  style: EnvStyle,
  entries: ComposeEnvEntry[]
) => {
  const headerPrefix = " ".repeat(envIndent);
  const entryPrefix = " ".repeat(envIndent + 2);
  const lines = [`${headerPrefix}environment:`];

  for (const entry of entries) {
    if (style === "list") {
      lines.push(`${entryPrefix}- ${entry.key}=${entry.value}`);
      continue;
    }

    const renderedValue = entry.value.trim() === "" ? `""` : entry.value;
    lines.push(`${entryPrefix}${entry.key}: ${renderedValue}`);
  }
  return lines;
};

export const parseComposeEnvironmentRows = (content: string): ConfigRow[] => {
  const { lines, blocks } = parseServiceBlocks(content);
  if (blocks.length === 0) {
    return [];
  }

  const rows: ConfigRow[] = [];
  for (const block of blocks) {
    if (block.envStart < 0 || block.envEnd <= block.envStart) {
      continue;
    }

    for (let i = block.envStart + 1; i < block.envEnd; i += 1) {
      const line = lines[i];
      if (isBlankOrComment(line)) {
        continue;
      }
      if (countLeadingSpaces(line) <= block.envIndent) {
        break;
      }

      const trimmed = line.trim();
      const parsed = block.envStyle === "list"
        ? parseListStyleEnvEntry(trimmed.replace(/^- /, "").trim())
        : parseMapStyleEnvEntry(trimmed);
      if (!parsed) {
        continue;
      }

      rows.push({
        id: `compose-env-${block.name}-${parsed.key}-${i}`,
        key: `${block.name}.${parsed.key}`,
        value: parsed.value,
        keyLocked: true,
        valueLocked: false,
        custom: false,
      });
    }
  }

  return rows;
};

export const applyComposeEnvironmentRows = (content: string, rows: ConfigRow[]) => {
  const { lines, blocks } = parseServiceBlocks(content);
  if (blocks.length === 0) {
    return normalizeContent(content);
  }

  const knownServices = new Set(blocks.map((block) => block.name));
  const defaultService = blocks[0].name;
  const desiredByService = new Map<string, ComposeEnvEntry[]>();
  for (const block of blocks) {
    desiredByService.set(block.name, []);
  }

  for (const row of rows) {
    if (row.custom && row.key.trim() === "" && row.value.trim() === "") {
      continue;
    }

    const scoped = parseScopedEnvKey(row.key, defaultService);
    if (!scoped) {
      continue;
    }
    if (!knownServices.has(scoped.service)) {
      throw new Error(`Unknown compose service prefix: ${scoped.service}`);
    }

    const entries = desiredByService.get(scoped.service);
    if (!entries) {
      continue;
    }

    const existingIndex = entries.findIndex((entry) => entry.key === scoped.key);
    if (existingIndex >= 0) {
      entries[existingIndex] = { key: scoped.key, value: row.value };
      continue;
    }
    entries.push({ key: scoped.key, value: row.value });
  }

  const output: string[] = [];
  let cursor = 0;

  for (const block of blocks) {
    output.push(...lines.slice(cursor, block.start));

    const desiredEntries = desiredByService.get(block.name) || [];
    if (block.envStart >= 0) {
      output.push(...lines.slice(block.start, block.envStart));
      if (desiredEntries.length > 0) {
        output.push(...renderEnvironmentBlock(block.envIndent, block.envStyle, desiredEntries));
      }
      output.push(...lines.slice(block.envEnd, block.end));
    } else if (desiredEntries.length > 0) {
      let insertAt = block.end;
      while (insertAt > block.start + 1 && lines[insertAt - 1]?.trim() === "") {
        insertAt -= 1;
      }
      output.push(...lines.slice(block.start, insertAt));
      output.push(...renderEnvironmentBlock(block.indent + 2, "map", desiredEntries));
      output.push(...lines.slice(insertAt, block.end));
    } else {
      output.push(...lines.slice(block.start, block.end));
    }

    cursor = block.end;
  }

  output.push(...lines.slice(cursor));

  const normalizedOriginal = normalizeContent(content);
  let result = output.join("\n");
  if (normalizedOriginal.endsWith("\n") && !result.endsWith("\n")) {
    result += "\n";
  }
  return result;
};
