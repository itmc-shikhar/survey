// Private insights page: HTTP Basic auth against ADMIN_PASSWORD (any username).
// Checked in proxy.ts (shows the browser login box) AND again where data is read.

export function isAdmin(authorization: string | null): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw === "change-me" || !authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(authorization.slice(6));
  } catch {
    return false;
  }
  return safeEqual(decoded.slice(decoded.indexOf(":") + 1), pw);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
