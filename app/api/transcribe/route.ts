import { NextResponse } from "next/server";
import { checkPasscode, requireEnv } from "@/lib/auth";
import { cyrToLat } from "@/lib/translit";

export const runtime = "nodejs";
export const maxDuration = 60;

const STT_MODEL = process.env.OPENAI_STT_MODEL ?? "gpt-4o-transcribe";

// Hints bias the recogniser toward the right language variant.
const PROMPTS: Record<string, string> = {
  sr: "Razgovor na srpskom jeziku, ekavica. Zdravo, kako ste? Hvala, može. Izvinite, nisam razumeo.",
  ru: "Разговор на русском языке.",
};

function extFor(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export async function POST(req: Request) {
  const denied = checkPasscode(req);
  if (denied) return denied;

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const lang = form.get("lang") === "ru" ? "ru" : "sr";
    if (!(audio instanceof Blob) || audio.size < 1000) {
      return NextResponse.json({ error: "Запись слишком короткая" }, { status: 400 });
    }

    const mime = (audio.type || "audio/webm").split(";")[0];
    const out = new FormData();
    out.append("file", new File([audio], `speech.${extFor(mime)}`, { type: mime }));
    out.append("model", STT_MODEL);
    out.append("language", lang);
    out.append("prompt", PROMPTS[lang]);
    out.append("response_format", "json");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}` },
      body: out,
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error("STT error", r.status, detail);
      return NextResponse.json({ error: `Speech-to-text failed (${r.status})` }, { status: 502 });
    }
    const data = (await r.json()) as { text?: string };
    let text = (data.text ?? "").trim();
    // Canonical storage for Serbian is Latin script; UI converts if user prefers Cyrillic.
    if (lang === "sr") text = cyrToLat(text);
    return NextResponse.json({ text });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
