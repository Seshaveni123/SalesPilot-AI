import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import { defaultSttProvider, defaultTtsProvider } from '../services/voiceService';
import type {
  ChatResponse,
  LeadContextSchema,
  RetrievedSource,
  VoicePreferences,
} from '../types';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
}

const EMPTY_LEAD_CONTEXT: LeadContextSchema = {
  name: null,
  email: null,
  phone: null,
  company: null,
  company_size: null,
  product_interest: null,
  budget: null,
  requirements: null,
  timeline: null,
  lead_score: null,
  lead_category: null,
  sentiment: null,
  objections: [],
};

export function useVoiceAgent(preferences: VoicePreferences) {
  const [sessionId, setSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [leadContext, setLeadContext] = useState<LeadContextSchema>(EMPTY_LEAD_CONTEXT);
  const [sources, setSources] = useState<RetrievedSource[]>([]);

  // Ref guards prevent duplicate submissions during rapid speech recognition events
  const inFlightRef = useRef<boolean>(false);
  const lastSubmittedRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const listeningRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string>(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const speechSupport = useMemo(
    () => ({
      sttSupported: defaultSttProvider.isSupported(),
      ttsSupported: defaultTtsProvider.isSupported(),
    }),
    []
  );

  const speakText = useCallback(
    (text: string) => {
      if (!speechSupport.ttsSupported) return;
      defaultTtsProvider.speak(text, {
        rate: preferences.speechRate,
        voiceURI: preferences.selectedVoiceURI,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: (msg) => {
          setIsSpeaking(false);
          setVoiceError(msg);
        },
      });
    },
    [preferences.selectedVoiceURI, preferences.speechRate, speechSupport.ttsSupported]
  );

  const stopSpeaking = useCallback(() => {
    defaultTtsProvider.stop();
    setIsSpeaking(false);
  }, []);

  const sendMessage = useCallback(
    async (rawText: string, channel: 'voice' | 'text' = 'text') => {
      const trimmed = rawText.trim();
      if (!trimmed || inFlightRef.current) return;

      const now = Date.now();
      if (
        lastSubmittedRef.current.text === trimmed &&
        now - lastSubmittedRef.current.at < 2500
      ) {
        return;
      }

      inFlightRef.current = true;
      lastSubmittedRef.current = { text: trimmed, at: now };
      setIsSending(true);
      setVoiceError(null);
      setInterimTranscript('');

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${now}_u`,
          role: 'user',
          content: trimmed,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      try {
        const data: ChatResponse = await apiClient.sendAgentChat({
          session_id: sessionIdRef.current,
          message: trimmed,
          channel,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_a`,
            role: 'assistant',
            content: data.reply,
            timestamp: new Date().toLocaleTimeString(),
            toolsUsed: data.tools_used,
          },
        ]);

        setLeadContext(data.lead_context);
        if (Array.isArray(data.retrieved_sources)) {
          setSources(data.retrieved_sources);
        }

        if (preferences.autoSpeak && data.reply) {
          speakText(data.reply);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach the SalesPilot AI backend.';
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_err`,
            role: 'error',
            content: `AI response unavailable: ${message}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } finally {
        inFlightRef.current = false;
        setIsSending(false);
      }
    },
    [preferences.autoSpeak, speakText]
  );

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    defaultSttProvider.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(async () => {
    setVoiceError(null);
    if (!speechSupport.sttSupported) {
      setVoiceError(
        'Browser Speech Recognition is not supported in this browser. Use Chrome or Edge, or type your message below.'
      );
      return;
    }

    // Stop active TTS playback so microphone does not capture assistant audio
    stopSpeaking();

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch {
      setVoiceError(
        'Microphone access was denied. Please allow microphone access in your browser.'
      );
      return;
    }

    listeningRef.current = true;
    setIsListening(true);

    defaultSttProvider.start(preferences.recognitionLang, {
      onInterimResult: (interim) => {
        setInterimTranscript(interim);
      },
      onFinalResult: (finalText) => {
        setInterimTranscript('');
        void sendMessage(finalText, 'voice');
      },
      onError: (errMsg) => {
        setVoiceError(errMsg);
        listeningRef.current = false;
        setIsListening(false);
      },
      onEnd: () => {
        listeningRef.current = false;
        setIsListening(false);
        setInterimTranscript('');
      },
    });
  }, [preferences.recognitionLang, sendMessage, speechSupport.sttSupported, stopSpeaking]);

  const toggleListening = useCallback(async () => {
    if (listeningRef.current) {
      stopListening();
    } else {
      await startListening();
    }
  }, [startListening, stopListening]);

  const resetSession = useCallback(() => {
    stopListening();
    stopSpeaking();
    setSessionId(`sess_${Date.now()}`);
    setMessages([]);
    setSources([]);
    setVoiceError(null);
    setLeadContext(EMPTY_LEAD_CONTEXT);
  }, [stopListening, stopSpeaking]);

  useEffect(() => {
    return () => {
      defaultSttProvider.stop();
      defaultTtsProvider.stop();
    };
  }, []);

  return {
    sessionId,
    messages,
    interimTranscript,
    isListening,
    isSending,
    isSpeaking,
    voiceError,
    leadContext,
    sources,
    speechSupport,
    sendMessage,
    toggleListening,
    speakText,
    stopSpeaking,
    resetSession,
  };
}
