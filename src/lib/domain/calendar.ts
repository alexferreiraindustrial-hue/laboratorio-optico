import { TIME_ZONE } from "./constants";

export function timeZoneOffset(date: Date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-3";
  const match = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return "-03:00";
  return `${match[1]}${match[2].padStart(2, "0")}:${(match[3] ?? "00").padStart(2, "0")}`;
}

export function zonedYmd(date: Date, timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function zonedStart(ymd: string, timeZone = TIME_ZONE) {
  const probe = new Date(`${ymd}T12:00:00Z`);
  const offset = timeZoneOffset(probe, timeZone);
  return new Date(`${ymd}T00:00:00${offset}`);
}

export function addDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function dayRange(now: Date, timeZone = TIME_ZONE) {
  const startYmd = zonedYmd(now, timeZone);
  const start = zonedStart(startYmd, timeZone);
  const end = zonedStart(addDays(startYmd, 1), timeZone);
  return { start, end, startYmd };
}

export function weekRange(now: Date, timeZone = TIME_ZONE) {
  const ymd = zonedYmd(now, timeZone);
  const weekday = weekdayOfYmd(ymd);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const startYmd = addDays(ymd, mondayOffset);
  const start = zonedStart(startYmd, timeZone);
  const end = zonedStart(addDays(startYmd, 7), timeZone);
  return { start, end, startYmd };
}

export function monthRange(now: Date, timeZone = TIME_ZONE) {
  const ymd = zonedYmd(now, timeZone);
  const startYmd = `${ymd.slice(0, 7)}-01`;
  const [year, month] = startYmd.split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start: zonedStart(startYmd, timeZone), end: zonedStart(next, timeZone), startYmd };
}

export function eachYmd(startYmd: string, endYmdExclusive: string) {
  const days: string[] = [];
  let cursor = startYmd;
  while (cursor < endYmdExclusive) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function countWorkingDays(start: Date, end: Date, weekdays: number[], timeZone = TIME_ZONE) {
  if (end.getTime() <= start.getTime()) return 0;
  const startYmd = zonedYmd(start, timeZone);
  const endYmd = zonedYmd(new Date(end.getTime() - 1), timeZone);
  return eachYmd(startYmd, addDays(endYmd, 1)).filter((ymd) => {
    const dayStart = zonedStart(ymd, timeZone);
    const dayEnd = zonedStart(addDays(ymd, 1), timeZone);
    const overlaps = dayEnd > start && dayStart < end;
    return overlaps && weekdays.includes(weekdayOfYmd(ymd));
  }).length;
}

export function dateTimeLocalToIso(value: string, timeZone = TIME_ZONE) {
  const [date, time] = value.split("T");
  if (!date || !time) throw new Error("Data inválida.");
  const probe = new Date(`${date}T12:00:00Z`);
  const offset = timeZoneOffset(probe, timeZone);
  const withSeconds = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${withSeconds}${offset}`).toISOString();
}
