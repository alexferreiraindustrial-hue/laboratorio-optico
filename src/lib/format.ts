import { TIME_ZONE } from "./domain/constants";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTime.format(date);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateOnly.format(date);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Sem meta";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatBRLFromCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  return money.format(cents / 100);
}

export function formatDiopter(cents: number | null | undefined) {
  if (cents == null) return "—";
  const signed = cents > 0 ? "+" : "";
  const text = (cents / 100).toFixed(2).replace(".", ",");
  return `${signed}${text}`;
}

export function formatHours(hours: number | null) {
  if (hours == null) return "—";
  if (hours < 24) return `${formatNumber(hours, 1)} h`;
  return `${formatNumber(hours / 24, 1)} dias`;
}

export function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
