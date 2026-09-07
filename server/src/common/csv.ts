const FORMULA_PREFIX = /^[\t\r]*[=+\-@]/;

type CsvCell = string | number | boolean | null | undefined;

export function escapeCsvCell(input: CsvCell): string {
  let value = input === null || input === undefined ? '' : `${input}`;
  if (FORMULA_PREFIX.test(value)) value = `'${value}`;
  if (/[",\r\n]/.test(value)) value = `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function csvRow(cells: CsvCell[]): string {
  return cells.map(escapeCsvCell).join(',');
}
