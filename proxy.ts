import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/admin";

// Shows the browser's login prompt for the private insights page.
export function proxy(req: NextRequest) {
  if (isAdmin(req.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Noticed insights", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/insights-d99d5rfhj7", "/insights-d99d5rfhj7/:path*"] };
