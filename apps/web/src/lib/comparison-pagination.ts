export function comparisonPage<T>(rows: readonly T[], requested: string) {
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const number = Number(requested);
  const page = Number.isSafeInteger(number) && number > 0 ? Math.min(number, pageCount) : 1;
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pageCount, pageSize };
}
