/**
 * Modular Browser Speech-to-Text (STT) and Text-to-Speech (TTS) adapters.
 * Defined behind interfaces so dedicated cloud STT/TTS providers (e.g., Deepgram,
 * ElevenLabs, Google Cloud Speech) can replace browser APIs without changing UI components.
 */

export interface SpeechRecognitionCallbacks {
  onInterimResult: (transcript: string) => void;
  onFinalResult: (transcript: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export interface SpeechToTextProvider {
  isSupported(): boolean;
  start(lang: string, callbacks: SpeechRecognitionCallbacks): void;
  stop(): void;
}

export interface TextToSpeechOptions {
  rate?: number;
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export interface TextToSpeechProvider {
  isSupported(): boolean;
  speak(text: string, options?: TextToSpeechOptions): void;
  stop(): void;
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  0: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function mapSpeechError(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Enable microphone access in your browser settings.';
    case 'audio-capture':
      return 'No microphone was detected. Connect an audio input device and try again.';
    case 'no-speech':
      return 'No speech was detected. Please speak clearly into your microphone.';
    case 'network':
      return 'Browser speech recognition encountered a network error.';
    case 'aborted':
      return '';
    default:
      return `Speech recognition error (${errorCode}).`;
  }
}

export class BrowserSpeechToText implements SpeechToTextProvider {
  private recognition: BrowserSpeechRecognitionInstance | null = null;

  isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  start(lang: string, callbacks: SpeechRecognitionCallbacks): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      callbacks.onError(
        'Browser Speech Recognition is unsupported here. Use Chrome or Edge, or type your message below.'
      );
      return;
    }

    this.stop();
    const instance = new Ctor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = lang || 'en-US';

    instance.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          finalChunk += `${text} `;
        } else {
          interim += text;
        }
      }
      if (interim.trim()) {
        callbacks.onInterimResult(interim.trim());
      }
      if (finalChunk.trim()) {
        callbacks.onFinalResult(finalChunk.trim());
      }
    };

    instance.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      const msg = mapSpeechError(event.error);
      if (msg) {
        callbacks.onError(msg);
      }
    };

    instance.onend = () => {
      this.recognition = null;
      callbacks.onEnd();
    };

    this.recognition = instance;
    instance.start();
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // Ignore stop errors when already inactive
      }
      this.recognition = null;
    }
  }
}

export class BrowserTextToSpeech implements TextToSpeechProvider {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string, options: TextToSpeechOptions = {}): void {
    if (!this.isSupported() || !text.trim()) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1.0;

    if (options.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find((v) => v.voiceURI === options.voiceURI);
      if (matched) {
        utterance.voice = matched;
      }
    }

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onError?.('Audio playback failed.');

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}

export const defaultSttProvider: SpeechToTextProvider = new BrowserSpeechToText();
export const defaultTtsProvider: TextToSpeechProvider = new BrowserTextToSpeech();
