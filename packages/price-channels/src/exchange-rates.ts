export interface EcbCnyRate {
  currency: string;
  rate: number;
  effectiveDate: string;
}

export const MAX_ECB_RATE_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1_000;

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (character === "," || character === "\n")) {
      row.push(field.trim());
      field = "";
      if (character === "\n") {
        rows.push(row);
        row = [];
      }
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("ecb_csv_shape_changed");
  if (field || row.length) rows.push([...row, field.trim()]);
  return rows;
}

/**
 * Converts daily EUR reference observations to CNY using matching dates.
 * Missing, invalid, future and stale observations yield no rate for that currency.
 * The age limit uses UTC calendar days so weekends do not expire Friday's rates.
 */
export function parseEcbCnyRates(csv: string, now = Date.now()): EcbCnyRate[] {
  if (!Number.isFinite(now)) throw new Error("ecb_invalid_reference_time");
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  const headers = rows.shift() ?? [];
  const currencyIndex = headers.indexOf("CURRENCY");
  const dateIndex = headers.indexOf("TIME_PERIOD");
  const valueIndex = headers.indexOf("OBS_VALUE");
  const denominatorIndex = headers.indexOf("CURRENCY_DENOM");
  if (currencyIndex < 0 || dateIndex < 0 || valueIndex < 0) {
    throw new Error("ecb_csv_shape_changed");
  }

  const observations = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const currency = row[currencyIndex];
    const date = row[dateIndex];
    const rate = Number(row[valueIndex]);
    if (!currency || !/^[A-Z]{3}$/.test(currency) || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    if (denominatorIndex >= 0 && row[denominatorIndex] !== "EUR") continue;
    const dateMs = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(dateMs) || new Date(dateMs).toISOString().slice(0, 10) !== date) continue;
    if (dateMs > today || today - dateMs > MAX_ECB_RATE_AGE_DAYS * DAY_MS) continue;
    let dates = observations.get(currency);
    if (!dates) {
      dates = new Map();
      observations.set(currency, dates);
    }
    dates.set(date, rate);
  }

  const cny = observations.get("CNY");
  if (!cny?.size) return [];
  const cnyDates = [...cny.keys()].sort().reverse();
  const latestDate = cnyDates[0]!;
  const rates: EcbCnyRate[] = [{ currency: "EUR", rate: cny.get(latestDate)!, effectiveDate: latestDate }];
  for (const currency of [...observations.keys()].sort()) {
    if (currency === "CNY" || currency === "EUR") continue;
    const observationsForCurrency = observations.get(currency)!;
    const date = cnyDates.find(value => observationsForCurrency.has(value));
    if (!date) continue;
    const rate = cny.get(date)! / observationsForCurrency.get(date)!;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    rates.push({ currency, rate, effectiveDate: date });
  }
  return rates;
}
