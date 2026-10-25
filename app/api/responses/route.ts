import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { MongoServerError, type Db } from "mongodb";
import { db } from "@/lib/mongo";
import { FORM_VERSION, cleanTag, contactKeys, validate, type Clean } from "@/lib/questions";

type Meta = { ref?: string; vouchBy?: string; startedAt?: Date; device: string };

// ponytail: no rate limiting; add per-IP limits (or Vercel Firewall) if spam shows up.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (body.website) return NextResponse.json({ ok: true, id: randomUUID() }); // honeypot: pretend success

  const result = validate(body.answers);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const now = Date.now();
  const meta: Meta = {
    ref: cleanTag(body.ref),
    vouchBy: cleanTag(body.vouch),
    startedAt: typeof body.startedAt === "number" && body.startedAt < now ? new Date(body.startedAt) : undefined,
    device: /Mobi|Android|iPhone/i.test(req.headers.get("user-agent") || "") ? "mobile" : "desktop",
  };

  try {
    const d = await db();
    let id: string;
    try {
      id = await save(d, result.value, meta);
    } catch (e) {
      // Two submissions with the same phone/email raced; the second one now finds the first and merges.
      if (e instanceof MongoServerError && e.code === 11000) id = await save(d, result.value, meta);
      else throw e;
    }
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("save failed", e);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}

// One response per person: a phone/email we've seen before updates that person's record instead of adding one.
async function save(d: Db, { answers, contact, branch }: Clean, meta: Meta): Promise<string> {
  const now = new Date();
  const keys = contact ? contactKeys(contact) : {};
  const match = Object.entries(keys).map(([k, v]) => ({ [k]: v }));
  const prev = match.length ? await d.collection("contacts").findOne({ $or: match }) : null;
  const respondentId: string = prev?.respondentId ?? randomUUID();

  await d.collection("responses").updateOne(
    { respondentId },
    {
      $set: {
        formVersion: FORM_VERSION,
        branch,
        answers,
        startedAt: meta.startedAt,
        submittedAt: now,
        durationSec: meta.startedAt ? Math.round((now.getTime() - meta.startedAt.getTime()) / 1000) : undefined,
        device: meta.device,
      },
      // First touch wins: keep the original channel and voucher.
      $setOnInsert: { respondentId, ref: meta.ref, vouchBy: meta.vouchBy, firstSubmittedAt: now },
      $inc: { submissions: 1 },
    },
    { upsert: true },
  );

  if (contact) {
    await d.collection("contacts").updateOne(
      { respondentId },
      { $set: { ...contact, ...keys, updatedAt: now }, $setOnInsert: { respondentId, createdAt: now } },
      { upsert: true },
    );
  }
  return respondentId;
}
