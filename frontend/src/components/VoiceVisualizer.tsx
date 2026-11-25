import React from 'react';
import { Bot, Loader2, Mic, Volume2 } from 'lucide-react';

interface VoiceVisualizerProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ state }) => {
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';

  const label = isListening
    ? 'Listening to prospect'
    : isThinking
    ? 'Reasoning & querying tools'
    : isSpeaking
    ? 'Speaking response'
    : 'Voice Studio Ready';

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        {(isListening || isSpeaking) && (
          <span
            className={`absolute inset-0 rounded-full animate-pulse-ring ${
              isListening ? 'bg-rose-400/50' : 'bg-indigo-400/50'
            }`}
          />
        )}
        <div
          className={`relative flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-all ${
            isListening
              ? 'border-rose-500 bg-rose-600 text-white'
              : isThinking
              ? 'border-indigo-500 bg-indigo-600 text-white'
              : isSpeaking
              ? 'border-indigo-500 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-glow'
              : 'border-zinc-200 bg-white text-indigo-600'
          }`}
        >
          {isListening ? (
            <Mic className="h-4 w-4" />
          ) : isThinking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSpeaking ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold text-zinc-950">{label}</span>
          {(isListening || isSpeaking) && (
            <div className="flex h-4 items-end gap-0.5" aria-hidden="true">
              <span
                className={`h-3.5 w-1 origin-bottom rounded-full animate-eq-bar-1 ${
                  isListening ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
              />
              <span
                className={`h-4 w-1 origin-bottom rounded-full animate-eq-bar-2 ${
                  isListening ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
              />
              <span
                className={`h-2.5 w-1 origin-bottom rounded-full animate-eq-bar-3 ${
                  isListening ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
              />
              <span
                className={`h-3.5 w-1 origin-bottom rounded-full animate-eq-bar-4 ${
                  isListening ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
              />
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {isListening
            ? 'Speak naturally — finalized phrases auto-submit'
            : isThinking
            ? 'Invoking Gemini LLM, RAG & CRM tools'
            : isSpeaking
            ? 'Playing synthesized voice reply'
            : 'Use microphone or type below to start'}
        </p>
      </div>
    </div>
  );
};
