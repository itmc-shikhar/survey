// Anonymous funnel events: which questions were seen, which options picked, where people stopped.
// Never carries typed text, phone or email: only question IDs and fixed option values.
import { QUESTIONS, cleanTag } from "./questions.ts";

export const EVENT_TYPES = ["landing", "start", "view", "answer", "skip", "submit", "under18", "already"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type TrackEvent = { sid: string; t: EventType; q?: string; v?: string | string[]; ref?: string };

const SID_RE = /^[a-f0-9-]{8,40}$/;
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

export function validateEvent(raw: unknown): TrackEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.sid !== "string" || !SID_RE.test(e.sid)) return null;
  if (!EVENT_TYPES.includes(e.t as EventType)) return null;
  const out: TrackEvent = { sid: e.sid, t: e.t as EventType, ref: cleanTag(e.ref) };
  if (e.q !== undefined) {
    const q = typeof e.q === "string" ? byId.get(e.q) : undefined;
    if (!q) return null;
    out.q = q.id;
    // Keep option values only for fixed-choice questions; drop anything else silently.
    if (q.kind === "single" && typeof e.v === "string" && q.options.includes(e.v)) out.v = e.v;
    if (q.kind === "multi" && Array.isArray(e.v) && e.v.every((x) => typeof x === "string" && q.options.includes(x)))
      out.v = e.v.slice(0, q.max) as string[];
  }
  return out;
}

// Client side: fire-and-forget, survives page close.
export function track(sid: string, t: EventType, q?: string, v?: unknown) {
  if (typeof navigator === "undefined" || !sid) return;
  const ref = new URLSearchParams(location.search).get("ref") || undefined;
  const body = JSON.stringify({ sid, t, q, v, ref });
  try {
    if (!navigator.sendBeacon?.("/api/events", body)) fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch { /* never break the survey for analytics */ }
}
