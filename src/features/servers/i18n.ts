export type TranslateValues = Record<string, string | number | Date>;

export type TranslateFn = (key: string, values?: TranslateValues) => string;
