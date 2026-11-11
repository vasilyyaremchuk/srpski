// Deterministic Serbian Latin <-> Cyrillic transliteration.
// Serbian is fully digraphic, so this is a 1:1 mapping (except the digraphs lj/nj/dž).

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "đ", е: "e", ж: "ž", з: "z", и: "i",
  ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r",
  с: "s", т: "t", ћ: "ć", у: "u", ф: "f", х: "h", ц: "c", ч: "č", џ: "dž", ш: "š",
};

const LAT_DIGRAPHS: Record<string, string> = { lj: "љ", nj: "њ", "dž": "џ" };
const LAT_SINGLE: Record<string, string> = {
  a: "а", b: "б", v: "в", g: "г", d: "д", "đ": "ђ", e: "е", "ž": "ж", z: "з", i: "и",
  j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", t: "т",
  "ć": "ћ", u: "у", f: "ф", h: "х", c: "ц", "č": "ч", "š": "ш",
};

function matchCase(src: string, out: string): string {
  if (src === src.toLowerCase()) return out;
  // "Lj" -> "Љ", "LJ" -> "Љ"
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function cyrToLat(text: string): string {
  let res = "";
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const lower = ch.toLowerCase();
    const mapped = CYR_TO_LAT[lower];
    if (mapped === undefined) {
      res += ch;
      continue;
    }
    if (ch === lower) {
      res += mapped;
    } else {
      // Uppercase: "Љубав" -> "Ljubav", "ЉУБАВ" -> "LJUBAV"
      const next = chars[i + 1];
      const nextIsUpper = next !== undefined && next !== next.toLowerCase();
      res += nextIsUpper ? mapped.toUpperCase() : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    }
  }
  return res;
}

export function latToCyr(text: string): string {
  // Leave URLs / emails alone
  return text.replace(/\S+/g, (word) => {
    if (/[@/]|https?:|www\./i.test(word)) return word;
    let res = "";
    const chars = [...word.normalize("NFC")];
    for (let i = 0; i < chars.length; i++) {
      const pair = (chars[i] + (chars[i + 1] ?? "")).toLowerCase();
      if (LAT_DIGRAPHS[pair]) {
        res += matchCase(chars[i], LAT_DIGRAPHS[pair]);
        i++;
        continue;
      }
      const lower = chars[i].toLowerCase();
      const single = LAT_SINGLE[lower];
      res += single ? matchCase(chars[i], single) : chars[i];
    }
    return res;
  });
}

/** True if the text contains Serbian/Russian Cyrillic letters. */
export function hasCyrillic(text: string): boolean {
  return /[Ѐ-ӿ]/.test(text);
}

export type Script = "lat" | "cyr";

/** Render Serbian text (stored canonically in Latin) in the chosen script. */
export function showSerbian(text: string, script: Script): string {
  return script === "cyr" ? latToCyr(text) : text;
}
