import { isAdmin } from "@/lib/admin";
import { loadRows, toCsv } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req.headers.get("authorization"))) return new Response("Not found", { status: 404 });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + toCsv(await loadRows()), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="noticed-responses-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
