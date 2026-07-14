'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useVoiceAssistant — React port of the old LocalShop `voice-ai.js` (v4).
 *
 * The heavy lifting (speech-to-text via Groq Whisper, the Gemini brain,
 * Sarvam text-to-speech) all lives in our own backend at POST /api/voice. This hook only handles the
 * browser side:
 *
 *   1. Record mic audio (MediaRecorder) with voice-activity detection —
 *      auto-stops after ~1.2s of silence, so the user just talks.
 *   2. POST the audio + catalog context (products/shops/cart/history) to the
 *      backend's /api/voice endpoint.
 *   3. Get back { transcript, replyText, replyAudio (wav b64), action fields },
 *      play the reply, hand actions to the caller, loop back to listening.
 *
 * Actions use a confirm-before-execute flow: the worker proposes a
 * `pendingAction`, we echo it back on the next turn, and only run it when the
 * worker returns `executeAction` (user said yes).
 */

// Voice endpoint lives in our own backend (POST /api/voice on Render) —
// all AI keys (Groq/Gemini/Sarvam) are server-side env vars there.
// NEXT_PUBLIC_VOICE_API_URL can override (e.g. to point back at a worker).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const VOICE_URL = process.env.NEXT_PUBLIC_VOICE_API_URL || `${API_URL}/voice`;

// VAD tuning — same values as the old site.
const SILENCE_THRESHOLD = 0.018;
const SILENCE_DURATION = 1200;
const MIN_SPEECH_MS = 300;
const MAX_RECORDING_MS = 25000;

export type VoiceMode = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VoiceAction {
  type: string;
  productName?: string;
  qty?: number;
  category?: string;
  shopName?: string;
  query?: string;
  [key: string]: unknown;
}

/** Payload shapes the worker prompt expects — keep in sync with the worker. */
export interface WorkerProduct {
  name: string;
  price: number;
  mrp: number | null;
  weight: string | null;
  shopName: string | null;
  category: string | null;
  inStock: boolean;
}
export interface WorkerShop {
  shopName: string;
  category: string | null;
  isOpen: boolean;
  /** True for home-service providers (electrician, plumber, …). */
  isService: boolean;
  /** Providers only: currently available for home visits. */
  availableNow: boolean;
  /** Distance from the customer in km (1 decimal), if known. */
  distanceKm: number | null;
}
export interface WorkerCartItem {
  name: string;
  qty: number;
  price: number;
}

interface UseVoiceAssistantOptions {
  /** Catalog context sent to the AI each turn. Read fresh on every request. */
  getContext: () => {
    products: WorkerProduct[];
    shops: WorkerShop[];
    cart: WorkerCartItem[];
  };
  /** Called when the user confirms an action. */
  onExecuteAction: (action: VoiceAction) => void;
}

interface WorkerResponse {
  transcript?: string;
  replyText?: string;
  replyAudio?: string;
  pendingAction?: VoiceAction | null;
  executeAction?: VoiceAction | null;
  cancelAction?: boolean;
  error?: string;
  detail?: string;
}

export function useVoiceAssistant({ getContext, onExecuteAction }: UseVoiceAssistantOptions) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<VoiceAction | null>(null);
  const [volume, setVolume] = useState(0);

  // Everything below is imperative recording machinery — refs, not state.
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const speechStartRef = useRef(0);
  const lastSoundRef = useRef(0);
  const pendingActionRef = useRef<VoiceAction | null>(null);
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Keep latest callbacks without re-creating the machinery.
  const getContextRef = useRef(getContext);
  getContextRef.current = getContext;
  const onExecuteRef = useRef(onExecuteAction);
  onExecuteRef.current = onExecuteAction;

  const setPending = useCallback((a: VoiceAction | null) => {
    pendingActionRef.current = a;
    setPendingAction(a);
  }, []);

  /* ---------------- teardown ---------------- */

  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    setVolume(0);
  }, []);

  const endConversation = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    setPending(null);
    stopVAD();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* already stopped */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    isRecordingRef.current = false;
    isProcessingRef.current = false;
    setMode('idle');
    setStatus('');
  }, [setPending, stopVAD]);

  // Full cleanup if the component unmounts mid-conversation.
  useEffect(() => endConversation, [endConversation]);

  /* ---------------- recording + VAD ---------------- */

  const stopRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
    isRecordingRef.current = false;
    stopVAD();
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    recorderRef.current.stop();
  }, [stopVAD]);

  const startVAD = useCallback(() => {
    const analyser = analyserRef.current;
    const data = volumeDataRef.current;
    if (!analyser || !data) return;
    stopVAD();
    vadIntervalRef.current = setInterval(() => {
      if (!isRecordingRef.current || !analyserRef.current) return;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const n = (data[i] - 128) / 128;
        sumSquares += n * n;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const now = Date.now();
      setVolume(Math.min(rms * 8, 0.8));
      if (rms > SILENCE_THRESHOLD) {
        if (speechStartRef.current === 0) speechStartRef.current = now;
        lastSoundRef.current = now;
      } else if (speechStartRef.current > 0) {
        if (now - lastSoundRef.current >= SILENCE_DURATION) stopRecording();
      }
    }, 80);
  }, [stopRecording, stopVAD]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    let mime = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mime)) {
      mime = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mime)) {
        mime = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mime)) mime = '';
      }
    }

    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(streamRef.current, { mimeType: mime })
        : new MediaRecorder(streamRef.current);
    } catch {
      setError("This browser can't record audio.");
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const speechDuration = lastSoundRef.current - speechStartRef.current;
      if (speechStartRef.current > 0 && speechDuration >= MIN_SPEECH_MS && blob.size > 1000) {
        void sendAudio(blob);
      } else if (activeRef.current && !isProcessingRef.current) {
        // Heard nothing usable — quietly listen again.
        setTimeout(() => startRecordingRef.current(), 100);
      }
    };

    recorder.start(250);
    speechStartRef.current = 0;
    lastSoundRef.current = 0;
    isRecordingRef.current = true;
    startVAD();

    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORDING_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startVAD, stopRecording]);

  // Self-reference so recorder.onstop can call the latest version.
  const startRecordingRef = useRef(startRecording);
  startRecordingRef.current = startRecording;

  const restartListening = useCallback(() => {
    if (!activeRef.current) return;
    setMode('listening');
    setStatus(pendingActionRef.current ? 'Bolo: haan ya nahi?' : 'Aapki sun raha hoon…');
    isProcessingRef.current = false;
    setTimeout(() => {
      if (activeRef.current && !isRecordingRef.current) startRecordingRef.current();
    }, 200);
  }, []);

  /* ---------------- worker round-trip ---------------- */

  const playAudio = useCallback(
    (base64: string) =>
      new Promise<void>((resolve) => {
        const done = () => {
          isProcessingRef.current = false;
          if (activeRef.current) restartListening();
          else {
            setMode('idle');
            setStatus('');
          }
          resolve();
        };
        try {
          const audio = new Audio('data:audio/wav;base64,' + base64);
          currentAudioRef.current = audio;
          setMode('speaking');
          setStatus('Bol raha hoon…');
          audio.onended = done;
          audio.onerror = done;
          audio.play().catch(done);
        } catch {
          done();
        }
      }),
    [restartListening]
  );

  const sendAudio = useCallback(
    async (blob: Blob) => {
      setMode('thinking');
      setStatus('Soch raha hoon…');
      setError(null);
      isProcessingRef.current = true;

      try {
        const ctx = getContextRef.current();
        const fd = new FormData();
        fd.append('audio', blob, 'audio.webm');
        fd.append('products', JSON.stringify(ctx.products));
        fd.append('shops', JSON.stringify(ctx.shops));
        fd.append('cart', JSON.stringify(ctx.cart));
        fd.append('history', JSON.stringify(historyRef.current.slice(-8)));
        fd.append('pendingAction', JSON.stringify(pendingActionRef.current));

        const res = await fetch(VOICE_URL, { method: 'POST', body: fd });
        const text = await res.text();

        let data: WorkerResponse;
        try {
          data = JSON.parse(text) as WorkerResponse;
        } catch {
          throw new Error('Server returned invalid JSON');
        }
        if (!res.ok) {
          const detail = data.detail ? ` (${data.detail.slice(0, 100)})` : '';
          throw new Error((data.error || `Server error ${res.status}`) + detail);
        }

        setTranscript(data.transcript || '');
        setReply(data.replyText || '');
        if (data.transcript) historyRef.current.push({ role: 'user', content: data.transcript });
        if (data.replyText) historyRef.current.push({ role: 'assistant', content: data.replyText });

        // Action lifecycle — same protocol as the old site.
        if (data.executeAction) {
          onExecuteRef.current(data.executeAction);
          setPending(null);
        } else if (data.cancelAction) {
          setPending(null);
        } else if (data.pendingAction) {
          setPending(data.pendingAction);
        } else {
          setPending(null);
        }

        setStatus('');
        if (data.replyAudio) {
          await playAudio(data.replyAudio);
        } else if (activeRef.current) {
          restartListening();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kuch problem aayi.');
        isProcessingRef.current = false;
        if (activeRef.current) setTimeout(() => restartListening(), 1500);
      }
    },
    [playAudio, restartListening, setPending]
  );

  /* ---------------- public API ---------------- */

  const startConversation = useCallback(async () => {
    setError(null);
    setTranscript('');
    setReply('');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setError('Mic access denied. Please allow microphone.');
      return;
    }
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(streamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      volumeDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    } catch {
      // VAD unavailable — the 25s safety timer still bounds each turn.
    }

    activeRef.current = true;
    setActive(true);
    setMode('listening');
    setStatus('Listening… bolo');
    startRecordingRef.current();
  }, []);

  const toggle = useCallback(() => {
    if (activeRef.current) endConversation();
    else void startConversation();
  }, [endConversation, startConversation]);

  return {
    active,
    mode,
    status,
    transcript,
    reply,
    error,
    pendingAction,
    volume,
    toggle,
    startConversation,
    endConversation,
  };
}
