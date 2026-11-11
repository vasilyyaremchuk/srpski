import { NextResponse } from "next/server";

/**
 * Very small guard so a public Vercel URL can't be used to burn API credits.
 * The client sends the passcode in the `x-app-passcode` header.
 */
export function checkPasscode(req: Request): NextResponse | null {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    return NextResponse.json(
      { error: "APP_PASSCODE is not set on the server" },
      { status: 500 },
    );
  }
  if (req.headers.get("x-app-passcode") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}
