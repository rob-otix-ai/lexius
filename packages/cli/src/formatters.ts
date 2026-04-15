export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatTable(
  data: Record<string, unknown>[],
  columns: string[],
): void {
  if (data.length === 0) {
    console.log("No results found.");
    return;
  }

  const widths = columns.map((col) =>
    Math.max(
      col.length,
      ...data.map((row) => String(row[col] ?? "").length),
    ),
  );

  const header = columns
    .map((col, i) => col.padEnd(widths[i]))
    .join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");

  console.log(header);
  console.log(separator);

  for (const row of data) {
    const line = columns
      .map((col, i) => String(row[col] ?? "").padEnd(widths[i]))
      .join("  ");
    console.log(line);
  }
}
