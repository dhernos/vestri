export type HistoricalLogFile = {
  name: string;
  path: string;
  size: number;
};

const logNameOrder = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
const isActiveLog = (file: HistoricalLogFile) =>
  /^(latest|current|server)\.log$/i.test(file.name);

export function sortHistoricalLogFiles(files: HistoricalLogFile[]) {
  return [...files].sort(
    (left, right) =>
      Number(isActiveLog(right)) - Number(isActiveLog(left)) ||
      logNameOrder.compare(right.name, left.name) ||
      logNameOrder.compare(right.path, left.path),
  );
}

export function selectHistoricalLogFile(
  files: HistoricalLogFile[],
  current = "",
) {
  return files.some((file) => file.path === current)
    ? current
    : files[0]?.path || "";
}
