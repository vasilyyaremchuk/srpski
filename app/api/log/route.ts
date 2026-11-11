import { NextResponse } from "next/server";
import { checkPasscode } from "@/lib/auth";
import { getDb, logTurn } from "@/lib/db";

export const runtime = "nodejs";

/** Saves a finished turn to Supabase. Silently skipped if Supabase isn't configured. */
export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;
  if (!getDb()) return NextResponse.json({ saved: false });

  const body = (await req.json()) as {
    sessionId: string;
    from: "sr" | "ru";
    text: string;
    translation: string;
    assist: unknown;
  };
  await logTurn({
    session_id: body.sessionId,
    direction: body.from === "sr" ? "sr-ru" : "ru-sr",
    source_text: body.text,
    translation: body.translation,
    assist: body.assist ?? null,
  });
  return NextResponse.json({ saved: true });
}
