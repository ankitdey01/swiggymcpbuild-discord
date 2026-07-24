/**
 * Generic helpers for reading loosely-typed JSON payloads returned by the
 * Swiggy MCP tools. These have no Discord or Swiggy-domain knowledge and are
 * shared by every module that parses raw tool output.
 */

export type JsonRecord = Record<string, unknown>;

/**
 * Unwraps the common `{ data }` / `{ result }` envelope, else returns the value
 * as-is. Returns `any` because callers traverse the (inherently dynamic) payload
 * shape directly — this is the intentional loose boundary; the value-reading
 * helpers below stay strict.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dataOf = (payload: any): any => payload?.data || payload?.result || payload;

export const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/** Returns the first non-empty string/number value among `keys`, trimmed. */
export function text(value: unknown, keys: string[]): string | null {
  if (!isRecord(value)) return null;

  for (const key of keys) {
    const child = value[key];
    const trimmed = (typeof child === "string" && child.trim()) || (typeof child === "number" && String(child));
    if (trimmed) return trimmed;
  }

  return null;
}

/** Coerces a single string/number value to a trimmed string, else null. */
export function compact(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

/** Returns the first positive numeric value among `keys`, else 0. */
export function number(value: unknown, keys: string[]): number {
  if (!isRecord(value)) return 0;

  for (const key of keys) {
    const child = value[key];
    const parsed = typeof child === "number" ? child : typeof child === "string" ? Number(child) : 0;
    if (parsed > 0) return parsed;
  }

  return 0;
}

/**
 * Depth-first search for the first array whose items satisfy `predicate`.
 * Returns `any[]` because callers index into the located records directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function firstArray(value: unknown, predicate: (item: any) => boolean): any[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value) && value.some(predicate)) return value;

  for (const child of Object.values(value)) {
    const found = firstArray(child, predicate);
    if (found.length) return found;
  }

  return [];
}

/** Recursive variant of {@link text}: searches nested objects for the keys. */
export function deepText(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;

  const direct = text(value, keys);
  if (direct) return direct;

  for (const child of Object.values(value)) {
    const found = deepText(child, keys);
    if (found) return found;
  }

  return null;
}

/** Recursively finds the first numeric value whose key includes one of `keys`. */
export function deepNumber(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== "object") return null;

  for (const [key, child] of Object.entries(value)) {
    if (keys.some((target) => key.toLowerCase().includes(target)) && typeof child === "number") return child;
  }

  for (const child of Object.values(value)) {
    const found = deepNumber(child, keys);
    if (found !== null) return found;
  }

  return null;
}

/** Replaces backticks so a value is safe inside an inline `code` span. */
export function escapeInline(value: string): string {
  return value.replace(/`/g, "'");
}

/** Escapes Discord markdown control characters. */
export function escapeMarkdown(value: string): string {
  return value.replace(/([\\*_~|`])/g, "\\$1");
}
