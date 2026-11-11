import type { HistoryTurn, Lang } from "./types";

export const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-5-5";
export const SMART_MODEL = process.env.ANTHROPIC_SMART_MODEL ?? "claude-sonnet-5-5";

const SHARED = `You help a native Russian speaker who lives in Serbia and is learning Serbian.
Serbian rules: standard Serbian, EKAVIAN (mleko, lepo, reka — never mlijeko/lijepo/rijeka),
always written in LATIN script (Latinica) with correct diacritics (č ć š ž đ dž).
Never substitute Croatian or Bosnian forms.`;

export function historyBlock(history: HistoryTurn[]): string {
  if (!history.length) return "";
  const lines = history
    .slice(-6)
    .map((t) =>
      t.from === "sr"
        ? `[Serbian speaker] ${t.text}  →  (ru) ${t.translation}`
        : `[User, in Russian] ${t.text}  →  (sr) ${t.translation}`,
    );
  return `Recent conversation (oldest first), for context only:\n${lines.join("\n")}\n\n`;
}

export function translateSystem(from: Lang): string {
  return from === "sr"
    ? `${SHARED}
Translate the Serbian utterance into natural, conversational Russian.
The text comes from speech recognition and may contain small errors — translate the most likely intended meaning.
Output ONLY the Russian translation. No quotes, no comments.`
    : `${SHARED}
The user says something in Russian that they want to say in Serbian.
Translate it into natural spoken Serbian (ekavian, Latin script), the way a Belgrade local would say it.
Output ONLY the Serbian sentence. No quotes, no comments.`;
}

export function assistSystem(from: Lang): string {
  const notesRules = `Notes (in Russian, max 4, only if genuinely useful — empty list is fine):
- false_friend: Serbian words that look/sound like Russian but mean something else
  (e.g. život=жизнь not живот, ponos=гордость, divan=чудесный, grad=город, jagoda=клубника, pitati=спрашивать, stolica=стул, kraj=конец).
  ALWAYS flag these when present.
- idiom / culture: set phrases, slang, Belgrade colloquialisms, politeness conventions.
- grammar: things a Russian speaker typically gets wrong (clitic position — je/sam/se/mu go 2nd; past tense needs auxiliary "sam bio";
  da + present instead of infinitive; vocative case; aspect differences).
- vocab / pronunciation: only when notable.`;

  return from === "sr"
    ? `${SHARED}
A Serbian speaker just said something to the user. Help the user understand it and answer.
${notesRules}
Replies: exactly 3 short, natural Serbian answers the user could say back, each fitting the conversation:
one neutral/short, one polite (Vi-form if the situation is formal, otherwise friendly), one that keeps the conversation going (e.g. a follow-up question).
Keep replies simple enough for an A2–B1 learner to pronounce. Give a Russian gloss for each.
If the recognised Serbian has obvious recognition errors, put your best corrected Serbian (Latin) in corrected_sr; otherwise omit it.
Detect the register the speaker used (formal Vi / informal ti / neutral).`
    : `${SHARED}
The user (a Russian speaker) wants to say something in Serbian. Help them say it well.
${notesRules}
Focus the notes on traps for a Russian speaker in THIS sentence.
Replies: exactly 3 Serbian variants of what the user wants to say: neutral, polite/formal (Vi), casual (ti).
Each with a Russian back-translation in "ru" so the user can check the nuance.
Omit corrected_sr.`;
}

export const ASSIST_TOOL = {
  name: "respond",
  description: "Return the structured help for this utterance.",
  input_schema: {
    type: "object" as const,
    properties: {
      corrected_sr: { type: "string", description: "Corrected Serbian (Latin), only if recognition clearly erred" },
      register: { type: "string", enum: ["formal", "informal", "neutral"] },
      notes: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["false_friend", "idiom", "grammar", "culture", "vocab", "pronunciation"],
            },
            sr: { type: "string", description: "Serbian word or phrase in Latin script" },
            explanation_ru: { type: "string", description: "Short explanation in Russian" },
          },
          required: ["kind", "sr", "explanation_ru"],
        },
      },
      replies: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            label_ru: { type: "string", description: "1–2 word label in Russian, e.g. Коротко / Вежливо / Продолжить" },
            sr: { type: "string", description: "Serbian, Latin script, ekavian" },
            ru: { type: "string", description: "Russian translation" },
          },
          required: ["label_ru", "sr", "ru"],
        },
      },
    },
    required: ["register", "notes", "replies"],
  },
};
