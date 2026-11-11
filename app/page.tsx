"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecorder } from "@/lib/useRecorder";
import { cyrToLat, showSerbian, type Script } from "@/lib/translit";
import type { AssistResult, HistoryTurn, Lang, Note } from "@/lib/types";

type Turn = {
  id: string;
  from: Lang;
  stage: "transcribing" | "translating" | "done" | "error";
  text: string;
  translation?: string;
  assist?: AssistResult;
  assistPending?: boolean;
  error?: string;
};

const NOTE_LABEL: Record<Note["kind"], string> = {
  false_friend: "Ложный друг",
  idiom: "Выражение",
  grammar: "Грамматика",
  culture: "Культура",
  vocab: "Слово",
  pronunciation: "Произношение",
};

const REGISTER_LABEL = { formal: "на «Вы»", informal: "на «ты»", neutral: "" } as const;

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
  return null;
}

/** Russian-only letters → treat typed text as Russian; otherwise Serbian. */
function detectLang(text: string): Lang {
  return /[ыэъяюёщйь]/i.test(text) ? "ru" : "sr";
}

export default function Home() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [passInput, setPassInput] = useState("");
  const [script, setScript] = useState<Script>("lat");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState(newId);
  const [activeLang, setActiveLang] = useState<Lang | null>(null);
  const [typed, setTyped] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [srVoice, setSrVoice] = useState<SpeechSynthesisVoice | null>(null);
  const feedEnd = useRef<HTMLDivElement>(null);
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const activeLangRef = useRef<Lang | null>(null);
  activeLangRef.current = activeLang;

  useEffect(() => {
    setPasscode(store("passcode"));
    const s = store("script");
    if (s === "cyr" || s === "lat") setScript(s);

    // Browser text-to-speech voice for Serbian, if the device has one.
    const pick = () => {
      const v = speechSynthesis
        .getVoices()
        .find((x) => x.lang.toLowerCase().startsWith("sr"));
      setSrVoice(v ?? null);
    };
    if (typeof speechSynthesis !== "undefined") {
      pick();
      speechSynthesis.addEventListener?.("voiceschanged", pick);
      return () => speechSynthesis.removeEventListener?.("voiceschanged", pick);
    }
  }, []);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const patch = (id: string, p: Partial<Turn>) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const api = useCallback(
    async <T,>(path: string, body: BodyInit, json = true): Promise<T> => {
      const r = await fetch(path, {
        method: "POST",
        headers: {
          "x-app-passcode": passcode ?? "",
          ...(json ? { "content-type": "application/json" } : {}),
        },
        body,
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) {
        store("passcode", "");
        setPasscode(null);
        throw new Error("Неверный код доступа");
      }
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      return data as T;
    },
    [passcode],
  );

  const history = (): HistoryTurn[] =>
    turnsRef.current
      .filter((t) => t.stage === "done" && t.translation)
      .slice(-6)
      .map((t) => ({ from: t.from, text: t.text, translation: t.translation! }));

  const processText = useCallback(
    async (id: string, text: string, from: Lang) => {
      patch(id, { text, stage: "translating", assistPending: true });
      const hist = history();
      const payload = JSON.stringify({ text, from, history: hist });

      let translation = "";
      let assist: AssistResult | undefined;

      const tr = api<{ translation: string }>("/api/translate", payload)
        .then((d) => {
          translation = d.translation;
          patch(id, { translation, stage: "done" });
        })
        .catch((e) => patch(id, { stage: "error", error: e.message }));

      const as = api<AssistResult>("/api/assist", payload)
        .then((d) => {
          assist = d;
          patch(id, { assist: d, assistPending: false });
        })
        .catch(() => patch(id, { assistPending: false }));

      await Promise.all([tr, as]);
      if (translation) {
        api("/api/log", JSON.stringify({ sessionId, from, text, translation, assist })).catch(
          () => {},
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, sessionId],
  );

  const onAudio = useCallback(
    async (blob: Blob, secs: number) => {
      const from = activeLangRef.current ?? "sr";
      setActiveLang(null);
      if (secs < 0.6) {
        flash("Слишком коротко — нажмите и говорите");
        return;
      }
      const id = newId();
      setTurns((ts) => [...ts, { id, from, stage: "transcribing", text: "" }]);
      try {
        const fd = new FormData();
        fd.append("audio", blob);
        fd.append("lang", from);
        const { text } = await api<{ text: string }>("/api/transcribe", fd, false);
        if (!text) {
          patch(id, { stage: "error", error: "Ничего не распознано" });
          return;
        }
        await processText(id, text, from);
      } catch (e) {
        patch(id, { stage: "error", error: (e as Error).message });
      }
    },
    [api, processText],
  );

  const rec = useRecorder(onAudio);

  const toggle = async (lang: Lang) => {
    if (rec.recording) {
      rec.stop();
      return;
    }
    try {
      setActiveLang(lang);
      activeLangRef.current = lang;
      await rec.start();
    } catch {
      setActiveLang(null);
      flash("Нет доступа к микрофону");
    }
  };

  const sendTyped = () => {
    const raw = typed.trim();
    if (!raw) return;
    const from = detectLang(raw);
    const text = from === "sr" ? cyrToLat(raw) : raw;
    const id = newId();
    setTurns((ts) => [...ts, { id, from, stage: "translating", text }]);
    setTyped("");
    processText(id, text, from);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Скопировано");
    } catch {
      flash("Не удалось скопировать");
    }
  };

  const speak = (text: string) => {
    if (!srVoice) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = srVoice;
    u.lang = srVoice.lang;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  };

  const sr = (t: string) => showSerbian(t, script);

  // ---------- Passcode gate ----------
  if (!passcode) {
    return (
      <main className="gate">
        <h1>Srpski helper</h1>
        <p>Введите код доступа (APP_PASSCODE)</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!passInput) return;
            store("passcode", passInput);
            setPasscode(passInput);
          }}
        >
          <input
            type="password"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            autoFocus
            placeholder="Код"
          />
          <button type="submit">Войти</button>
        </form>
      </main>
    );
  }

  // ---------- Main ----------
  return (
    <main className="app">
      <header className="top">
        <span className="brand">Srpski ⇄ Русский</span>
        <div className="top-actions">
          <div className="seg" role="group" aria-label="Алфавит">
            {(["lat", "cyr"] as const).map((s) => (
              <button
                key={s}
                className={script === s ? "on" : ""}
                onClick={() => {
                  setScript(s);
                  store("script", s);
                }}
              >
                {s === "lat" ? "Lat" : "Ћир"}
              </button>
            ))}
          </div>
          <button
            className="ghost"
            onClick={() => {
              setTurns([]);
              setSessionId(newId());
            }}
            title="Новый разговор"
          >
            Новый
          </button>
        </div>
      </header>

      <section className="feed">
        {turns.length === 0 && (
          <div className="empty">
            <p>
              <b>Слушать</b> — когда говорит собеседник по-сербски.
            </p>
            <p>
              <b>Сказать</b> — скажите по-русски, получите фразу на сербском.
            </p>
            <p className="muted">Нажмите один раз, чтобы начать, и ещё раз, чтобы остановить.</p>
          </div>
        )}

        {turns.map((t) => (
          <article key={t.id} className={`turn ${t.from}`}>
            <div className="who">{t.from === "sr" ? "Собеседник · SR" : "Я · RU → SR"}</div>

            {t.stage === "transcribing" ? (
              <div className="pending">Распознаю речь…</div>
            ) : (
              <div className="orig">{t.from === "sr" ? sr(t.text) : t.text}</div>
            )}

            {t.assist?.corrected_sr && t.from === "sr" && t.assist.corrected_sr !== t.text && (
              <div className="corrected">вероятно: {sr(t.assist.corrected_sr)}</div>
            )}

            {t.stage === "translating" && <div className="pending">Перевожу…</div>}
            {t.translation && (
              <div className="translation" onClick={() => copy(t.translation!)}>
                {t.from === "sr" ? t.translation : sr(t.translation)}
                {t.assist && REGISTER_LABEL[t.assist.register] && (
                  <span className="badge">{REGISTER_LABEL[t.assist.register]}</span>
                )}
              </div>
            )}
            {t.stage === "error" && <div className="error">{t.error}</div>}

            {t.assist && t.assist.notes.length > 0 && (
              <ul className="notes">
                {t.assist.notes.map((n, i) => (
                  <li key={i} className={n.kind}>
                    <span className="kind">{NOTE_LABEL[n.kind] ?? n.kind}</span>
                    <b>{sr(n.sr)}</b> — {n.explanation_ru}
                  </li>
                ))}
              </ul>
            )}

            {t.assistPending && t.stage !== "transcribing" && (
              <div className="pending small">Готовлю варианты ответа…</div>
            )}

            {t.assist && t.assist.replies.length > 0 && (
              <div className="replies">
                <div className="replies-title">
                  {t.from === "sr" ? "Можно ответить" : "Как сказать по-сербски"}
                </div>
                {t.assist.replies.map((r, i) => (
                  <div key={i} className="reply">
                    <button className="reply-main" onClick={() => copy(sr(r.sr))}>
                      <span className="reply-label">{r.label_ru}</span>
                      <span className="reply-sr">{sr(r.sr)}</span>
                      <span className="reply-ru">{r.ru}</span>
                    </button>
                    {srVoice && (
                      <button className="speak" onClick={() => speak(r.sr)} aria-label="Произнести">
                        ▶
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
        <div ref={feedEnd} />
      </section>

      <footer className="bottom">
        <form
          className="typed"
          onSubmit={(e) => {
            e.preventDefault();
            sendTyped();
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Или напишите (SR или RU)"
            enterKeyHint="send"
          />
          <button type="submit" disabled={!typed.trim()}>
            ↵
          </button>
        </form>
        <div className="mics">
          {(["sr", "ru"] as const).map((lang) => {
            const isActive = rec.recording && activeLang === lang;
            const disabled = rec.recording && activeLang !== lang;
            return (
              <button
                key={lang}
                className={`mic ${lang} ${isActive ? "rec" : ""}`}
                disabled={disabled}
                onClick={() => toggle(lang)}
                style={isActive ? { ["--lvl" as string]: rec.level.toFixed(2) } : undefined}
              >
                {isActive ? (
                  <>
                    <span className="dot" /> Стоп · {rec.seconds}s
                  </>
                ) : lang === "sr" ? (
                  <>
                    Слушать
                    <small>сербский</small>
                  </>
                ) : (
                  <>
                    Сказать
                    <small>по-русски</small>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
