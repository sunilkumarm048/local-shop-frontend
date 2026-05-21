'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Speech API hook.
 *
 *   - Detects support (Chrome / Edge / Safari yes; Firefox no, currently).
 *   - Exposes start / stop / listening flag / transcript / error.
 *   - Auto-stops after a single utterance ("recognition.continuous = false")
 *     so the user gets a tap-once-then-speak flow rather than always-on.
 *   - On stop, the resolved transcript is passed back via the `onFinal`
 *     callback. We deliberately don't keep transcript state forever —
 *     each session starts fresh.
 *
 * The browser ships two constructors:
 *   - `SpeechRecognition` (standard, Edge / Chromium 33+)
 *   - `webkitSpeechRecognition` (older Chrome, Safari)
 * We try both.
 */

// Browser global typings — TypeScript doesn't include these natively.
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface Options {
  /** Called with the final transcript once recognition stops. */
  onFinal: (transcript: string) => void;
  /** Optional language tag. Defaults to en-IN if available, else en-US. */
  lang?: string;
}

export function useSpeechRecognition({ onFinal, lang }: Options) {
  // Stable refs so callbacks captured in the recognition object don't go stale.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recogRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const recog = new Ctor();
    recog.continuous = false;
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.lang = lang || 'en-IN';

    recog.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim('');
        // Note: don't stop here — onend handles cleanup so a partial transcript
        // doesn't race a manual stop. We just record the final text.
        onFinalRef.current(finalText.trim());
      }
    };

    recog.onerror = (event) => {
      // 'no-speech' fires when the user clicks but doesn't talk; we treat
      // that as quiet, not an error.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(event.message || event.error || 'Recognition error');
    };

    recog.onend = () => {
      setListening(false);
      setInterim('');
    };

    recogRef.current = recog;
    return () => {
      try {
        recog.abort();
      } catch {
        /* ignore */
      }
      recogRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recogRef.current) return;
    setError(null);
    setInterim('');
    try {
      recogRef.current.start();
      setListening(true);
    } catch (err) {
      // Calling start() while already-listening throws — treat as a no-op.
      console.warn('[voice] start failed:', err);
    }
  }, []);

  const stop = useCallback(() => {
    if (!recogRef.current) return;
    try {
      recogRef.current.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return { supported, listening, interim, error, start, stop };
}
