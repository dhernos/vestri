import type { GameServerTemplateVersionField } from "@/features/servers/types";

export const normalizeFieldOptions = (
  field?: GameServerTemplateVersionField,
  software?: string
): string[] => {
  if (!field) {
    return [];
  }

  let sourceOptions: string[] | undefined;
  const normalizedSoftware = software?.trim().toLowerCase() || "";
  if (normalizedSoftware && field.optionsBySoftware) {
    for (const [softwareKey, values] of Object.entries(field.optionsBySoftware)) {
      if (softwareKey.trim().toLowerCase() !== normalizedSoftware) {
        continue;
      }
      sourceOptions = Array.isArray(values) ? values : [];
      break;
    }
  }
  if (!sourceOptions && Array.isArray(field.options)) {
    sourceOptions = field.options;
  }
  if (!Array.isArray(sourceOptions)) {
    return [];
  }

  return sourceOptions
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
};

export const resolveFieldValue = (
  current: string,
  field?: GameServerTemplateVersionField,
  software?: string
): string => {
  if (!field) {
    return "";
  }

  const options = normalizeFieldOptions(field, software);
  const trimmedCurrent = current.trim();

  if (trimmedCurrent) {
    if (options.length === 0) {
      return trimmedCurrent;
    }
    const matched = options.find((option) => option.toLowerCase() === trimmedCurrent.toLowerCase());
    if (matched) {
      return matched;
    }
  }

  const defaultValue = (field.defaultValue || "").trim();
  if (defaultValue) {
    if (options.length === 0) {
      return defaultValue;
    }
    const matchedDefault = options.find(
      (option) => option.toLowerCase() === defaultValue.toLowerCase()
    );
    if (matchedDefault) {
      return matchedDefault;
    }
  }

  if (options.length > 0) {
    return options[0];
  }

  return "";
};
