export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function compactText(value: unknown, maxLength = 900): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

export function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
