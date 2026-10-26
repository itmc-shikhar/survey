// Server only: imported by the insights page and its CSV route, never by client components.
import { db } from "./mongo";
import { QUESTIONS, type Contact } from "./questions";

// ponytail: loads up to 5000 responses and aggregates in memory; move counts into Mongo pipelines past ~10k.
const LIMIT = 5000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/;

export type Row = {
  respondentId: string;
  branch: string;
  answers: Record<string, unknown>;
  ref?: string;
  vouchBy?: string;
  submittedAt: Date;
  firstSubmittedAt?: Date;
  durationSec?: number;
  submissions?: number;
  device?: string;
  contact?: Contact;
};

export async function loadRows(): Promise<Row[]> {
  const d = await db();
  const [responses, contacts] = await Promise.all([
    d.collection("responses").find({}, { projection: { _id: 0 } }).sort({ submittedAt: -1 }).limit(LIMIT).toArray(),
    d.collection("contacts").find({}, { projection: { _id: 0, phoneKey: 0, emailKey: 0 } }).toArray(),
  ]);
  const byId = new Map(contacts.map((c) => [c.respondentId, c as unknown as Contact]));
  return responses.map((r) => ({ ...(r as unknown as Row), contact: byId.get(r.respondentId) }));
}

const isWoman = (r: Row) => r.branch === "woman";
const isMan = (r: Row) => r.branch === "man";
const gaveContact = (r: Row) => !!(r.answers.G1 as { given?: boolean } | undefined)?.given;
const wantsSession = (r: Row) => r.answers.G3 === "Yes";

function tally(rows: Row[]) {
  return {
    responses: rows.length,
    women: rows.filter(isWoman).length,
    men: rows.filter(isMan).length,
    contacts: rows.filter(gaveContact).length,
    womenContacts: rows.filter((r) => isWoman(r) && gaveContact(r)).length,
    sessionYes: rows.filter(wantsSession).length,
    vouched: rows.filter((r) => r.vouchBy).length,
  };
}
export type Tally = ReturnType<typeof tally>;

function groupBy(rows: Row[], key: (r: Row) => string) {
  const m = new Map<string, Row[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) || []), r]);
  return [...m].map(([name, rs]) => ({ name, ...tally(rs) }));
}

const channelOf = (r: Row) => (!r.ref ? "(no code)" : UUID_RE.test(r.ref) ? "(shared by a respondent)" : r.ref);
const norm = (v: unknown) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();
const placeOf = (r: Row) => `${norm(r.answers.A5) || "?"} · ${norm(r.answers.A6) || "—"}`;

export async function loadInsights() {
  const d = await db();
  const ev = d.collection("events");
  const [rows, landingSids, startSids, already, viewsAgg, skipsAgg, dropAgg] = await Promise.all([
    loadRows(),
    ev.distinct("sid", { t: "landing" }),
    ev.distinct("sid", { t: "start" }),
    ev.countDocuments({ t: "already" }),
    ev.aggregate([{ $match: { t: "view" } }, { $group: { _id: { q: "$q", sid: "$sid" } } }, { $group: { _id: "$_id.q", n: { $sum: 1 } } }]).toArray(),
    ev.aggregate([{ $match: { t: "skip" } }, { $group: { _id: "$q", n: { $sum: 1 } } }]).toArray(),
    // Where unfinished sessions stopped: the last question each one viewed.
    ev.aggregate([
      { $match: { t: { $in: ["view", "submit", "under18"] } } },
      { $sort: { at: 1 } },
      { $group: { _id: "$sid", last: { $last: "$q" }, ended: { $max: { $cond: [{ $in: ["$t", ["submit", "under18"]] }, 1, 0] } } } },
      { $match: { ended: 0 } },
      { $group: { _id: "$last", n: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const count = (agg: { _id: unknown; n: number }[]) => new Map(agg.map((a) => [a._id as string, a.n]));
  const views = count(viewsAgg as never), skips = count(skipsAgg as never), drops = count(dropAgg as never);

  const funnel = QUESTIONS.filter((q) => q.kind !== "info").map((q) => ({
    id: q.id, text: q.text, viewed: views.get(q.id) || 0, skipped: skips.get(q.id) || 0, droppedHere: drops.get(q.id) || 0,
  }));

  const options = QUESTIONS.flatMap((q) => {
    if (q.kind !== "single" && q.kind !== "multi") return [];
    const answered = rows.filter((r) => r.answers[q.id] !== undefined);
    const has = (r: Row, o: string) => {
      const v = r.answers[q.id];
      return Array.isArray(v) ? v.includes(o) : v === o;
    };
    return [{
      id: q.id, text: q.text, answered: answered.length,
      rows: q.options.map((o) => ({
        option: o,
        total: answered.filter((r) => has(r, o)).length,
        women: answered.filter((r) => isWoman(r) && has(r, o)).length,
        men: answered.filter((r) => isMan(r) && has(r, o)).length,
      })),
    }];
  });

  return {
    overview: { landing: landingSids.length, started: startSids.length, already, ...tally(rows), capped: rows.length >= LIMIT },
    funnel,
    options,
    channels: groupBy(rows, channelOf).sort((a, b) => b.responses - a.responses),
    places: groupBy(rows, placeOf).sort((a, b) => b.womenContacts - a.womenContacts || b.responses - a.responses),
    recent: rows.slice(0, 300),
  };
}

// CSV: one row per respondent, one column per question, contact details last.
export function toCsv(rows: Row[]): string {
  const qs = QUESTIONS.filter((q) => q.kind !== "info" && q.kind !== "contact" && q.kind !== "consent");
  const head = ["submittedAt", "branch", "ref", "vouchBy", "submissions", "durationSec", "device", ...qs.map((q) => q.id), "phone", "email", "platform"];
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
    // Quote everything; neutralise spreadsheet formulas (=, +, -, @) from user text.
    return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [r.submittedAt, r.branch, r.ref, r.vouchBy, r.submissions, r.durationSec, r.device, ...qs.map((q) => r.answers[q.id]),
      r.contact?.phone, r.contact?.email, r.contact?.platform].map(cell).join(","),
  );
  return [head.map(cell).join(","), ...lines].join("\r\n");
}
