type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(timeZone: string, date: Date): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedOffsetMs(timeZone: string, date: Date): number {
  const parts = zonedParts(timeZone, date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function resolveTimeZone(timeZone: string | undefined): string {
  const candidate = timeZone?.trim() || "Asia/Riyadh";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "Asia/Riyadh";
  }
}

/** UTC instant of midnight on the first day of `date`'s month in `timeZone`. */
export function startOfZonedMonth(timeZone: string, now = new Date()): Date {
  const zone = resolveTimeZone(timeZone);
  const parts = zonedParts(zone, now);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0);
  const offset = zonedOffsetMs(zone, new Date(utcGuess));
  const start = new Date(utcGuess - offset);
  const offsetAtStart = zonedOffsetMs(zone, start);
  if (offsetAtStart !== offset) return new Date(utcGuess - offsetAtStart);
  return start;
}
