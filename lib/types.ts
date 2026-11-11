export type Lang = "sr" | "ru";

export interface HistoryTurn {
  from: Lang;
  text: string; // original (Serbian kept in Latin)
  translation: string;
}

export interface Note {
  kind: "false_friend" | "idiom" | "grammar" | "culture" | "vocab" | "pronunciation";
  sr: string; // the Serbian word/phrase (Latin)
  explanation_ru: string;
}

export interface ReplyOption {
  label_ru: string; // e.g. "Вежливо", "Коротко"
  sr: string; // Serbian (Latin)
  ru: string; // Russian gloss
}

export interface AssistResult {
  corrected_sr?: string; // cleaned-up Serbian if STT obviously misheard
  register: "formal" | "informal" | "neutral";
  notes: Note[];
  replies: ReplyOption[];
}
