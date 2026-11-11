import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkPasscode } from "@/lib/auth";
import { FAST_MODEL, historyBlock, translateSystem } from "@/lib/prompts";
import type { HistoryTurn, Lang } from "@/lib/types";
import { cyrToLat } from "@/lib/translit";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;

  try {
    const { text, from, history = [] } = (await req.json()) as {
      text: string;
      from: Lang;
      history?: HistoryTurn[];
    };
    if (!text?.trim()) return NextResponse.json({ error: "empty text" }, { status: 400 });

    const msg = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 600,
      system: translateSystem(from),
      messages: [{ role: "user", content: `${historyBlock(history)}Utterance:\n${text}` }],
    });
    let translation = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (from === "ru") translation = cyrToLat(translation);
    return NextResponse.json({ translation });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
