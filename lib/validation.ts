export const MODES = ["warm_up", "stretch", "fix_weaknesses"] as const;
export type Mode = (typeof MODES)[number];
export type Params = Record<string, string | string[] | undefined>;
export function value(p: Params, key: string, fallback = ""): string {
  return typeof p[key] === "string" ? p[key] as string : fallback;
}
export function validHandle(input: unknown): string {
  if (typeof input !== "string" || !/^[a-zA-Z0-9_.-]{1,40}$/.test(input.trim())) {
    throw new Error("Enter a valid Codeforces handle using letters, numbers, dots, underscores or hyphens.");
  }
  return input.trim();
}
export function modeValue(input: string): Mode { return MODES.includes(input as Mode) ? input as Mode : "stretch"; }
export function integer(input: string, fallback: number, min: number, max: number): number {
  if (!/^\d+$/.test(input)) return fallback;
  return Math.min(max, Math.max(min, Number(input)));
}
export function problemKey(input: string): { contest: number; index: string } | null {
  const match = input.trim().match(/^(\d{1,7})\s*[/\-]?\s*([a-zA-Z]\d?|\d{2})$/);
  return match ? { contest: Number(match[1]), index: match[2].toUpperCase() } : null;
}
export function withParams(path: string, params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, item] of Object.entries(params)) if (item !== undefined && item !== null && item !== "") q.set(key, String(item));
  return `${path}${q.size ? `?${q}` : ""}`;
}
export const number = (n: number | string | null | undefined) => n == null ? "—" : Number(n).toLocaleString("en-US");
export const cfProblem = (contest: number, index: string) => `https://codeforces.com/problemset/problem/${contest}/${encodeURIComponent(index)}`;
