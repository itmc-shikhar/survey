import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/mongo";
import { FORM_VERSION, cleanTag, validate } from "@/lib/questions";

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

  const { answers, contact, branch } = result.value;
  const now = new Date();
  const startedAt = typeof body.startedAt === "number" && body.startedAt < now.getTime() ? new Date(body.startedAt) : undefined;
  const respondentId = randomUUID();
  const ua = req.headers.get("user-agent") || "";

  try {
    const d = await db();
    await d.collection("responses").insertOne({
      respondentId,
      formVersion: FORM_VERSION,
      branch,
      answers,
      ref: cleanTag(body.ref),
      vouchBy: cleanTag(body.vouch),
      startedAt,
      submittedAt: now,
      durationSec: startedAt ? Math.round((now.getTime() - startedAt.getTime()) / 1000) : undefined,
      device: /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop",
    });
    if (contact) await d.collection("contacts").insertOne({ respondentId, ...contact, createdAt: now });
  } catch (e) {
    console.error("save failed", e);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: respondentId });
}
