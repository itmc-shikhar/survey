import { db } from "@/lib/mongo";
import { validateEvent } from "@/lib/track";

// sendBeacon posts text/plain, so parse the raw body. Always 204: analytics must never surface errors.
export async function POST(req: Request) {
  try {
    const e = validateEvent(JSON.parse(await req.text()));
    if (e) await (await db()).collection("events").insertOne({ ...e, at: new Date() });
  } catch (err) {
    console.error("event dropped", err);
  }
  return new Response(null, { status: 204 });
}
