const sekFormatter = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("sv-SE", {
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Stockholm",
});

export function formatOre(ore: number): string {
  if (!Number.isSafeInteger(ore)) throw new TypeError("ore must be a safe integer");
  return sekFormatter.format(ore / 100);
}

export function formatMileageKmAsMil(kilometers: number): string {
  if (!Number.isSafeInteger(kilometers) || kilometers < 0) {
    throw new TypeError("kilometers must be a non-negative safe integer");
  }
  return `${integerFormatter.format(kilometers / 10)} mil`;
}

export function formatSwedishDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}
