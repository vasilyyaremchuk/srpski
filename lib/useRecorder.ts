"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SECONDS = 120;

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Tap-to-start / tap-to-stop microphone recorder. Releases the mic after each take. */
export function useRecorder(onDone: (blob: Blob, seconds: number) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      cleanup();
      setRecording(false);
      const secs = (Date.now() - startedAt.current) / 1000;
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      onDoneRef.current(blob, secs);
    };

    // Simple input level meter so you can see the mic is hearing something.
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 64));
        raf.current = requestAnimationFrame(tick);
      };
      audioCtx.current = ctx;
      tick();
    } catch {
      /* meter is optional */
    }

    recRef.current = rec;
    startedAt.current = Date.now();
    setSeconds(0);
    setRecording(true);
    rec.start(250);
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 250);
  }, [cleanup, stop]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { recording, seconds, level, start, stop };
}
