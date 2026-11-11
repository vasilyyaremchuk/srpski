import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { checkPasscode } from "@/lib/auth";
import { ASSIST_TOOL, SMART_MODEL, assistSystem, historyBlock } from "@/lib/prompts";
import type { AssistResult, HistoryTurn, Lang } from "@/lib/types";

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
      model: SMART_MODEL,
      max_tokens: 1500,
      system: assistSystem(from),
      tools: [ASSIST_TOOL],
      tool_choice: { type: "tool", name: ASSIST_TOOL.name },
      messages: [{ role: "user", content: `${historyBlock(history)}Utterance (${from}):\n${text}` }],
    });

    const tool = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!tool) return NextResponse.json({ error: "no structured output" }, { status: 502 });
    const result = tool.input as AssistResult;

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
