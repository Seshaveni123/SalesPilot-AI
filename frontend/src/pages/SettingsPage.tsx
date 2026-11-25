import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, Play, RotateCcw, Server, Volume2, XCircle } from 'lucide-react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { useVoicePreferences } from '../hooks/useVoicePreferences';
import { API_BASE_URL } from '../services/api';
import { defaultTtsProvider } from '../services/voiceService';
import type { SystemHealth } from '../types';

interface SettingsPageProps {
  health: SystemHealth;
  onRefreshHealth: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  health,
  onRefreshHealth,
}) => {
  const { preferences, updatePreferences, resetPreferences } = useVoicePreferences();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const handleTestVoice = () => {
    defaultTtsProvider.speak(
      'Hello, this is SalesPilot AI. Your browser text-to-speech playback is ready.',
      {
        rate: preferences.speechRate,
        voiceURI: preferences.selectedVoiceURI,
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Configure browser voice synthesis preferences, inspect service connectivity, and review scoring transparency."
        actions={
          <button
            type="button"
            onClick={resetPreferences}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Voice & Speech Settings */}
        <Card className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Volume2 className="h-5 w-5 text-brand-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Voice & Speech Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Saved locally in your browser for Web Speech API interactions
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={!defaultTtsProvider.isSupported()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 text-brand-600" />
              Test Audio
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Auto-play AI responses
              </p>
              <p className="text-xs text-slate-500">
                Automatically speak assistant replies using Speech Synthesis
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.autoSpeak}
              onChange={(e) => updatePreferences({ autoSpeak: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <label htmlFor="speech-rate" className="font-medium text-slate-700">
                Speech Rate
              </label>
              <span className="font-mono font-semibold text-slate-900">
                {preferences.speechRate.toFixed(1)}x
              </span>
            </div>
            <input
              id="speech-rate"
              type="range"
              min="0.7"
              max="1.5"
              step="0.1"
              value={preferences.speechRate}
              onChange={(e) =>
                updatePreferences({ speechRate: parseFloat(e.target.value) })
              }
              className="w-full accent-brand-600"
            />
          </div>

          <div>
            <label
              htmlFor="tts-voice"
              className="mb-1.5 block text-xs font-medium text-slate-700"
            >
              Browser Text-to-Speech Voice
            </label>
            <select
              id="tts-voice"
              value={preferences.selectedVoiceURI}
              onChange={(e) =>
                updatePreferences({ selectedVoiceURI: e.target.value })
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="">System Default Voice</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Backend & Diagnostics */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Server className="h-5 w-5 text-brand-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Service Diagnostics
                </h2>
                <p className="text-xs text-slate-500">
                  Live connectivity check against configured API endpoint
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRefreshHealth}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Re-check
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="text-slate-500">Configured API Base URL</span>
            <p className="mt-1 font-mono font-medium text-slate-900">{API_BASE_URL}</p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-slate-700">Backend API Reachable</span>
              {health.status === 'online' ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-rose-700">
                  <XCircle className="h-4 w-4" /> Offline
                </span>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-slate-700">Gemini LLM API Key Configured</span>
              <span className="font-medium text-slate-600">
                {health.gemini_configured ? 'Configured' : 'Not detected'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-slate-700">Database Connected</span>
              <span className="font-medium text-slate-600">
                {health.database_connected ? 'Connected' : 'Unavailable'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-slate-700">FAISS Vector Knowledge Index</span>
              <span className="font-medium text-slate-600">
                {health.rag_indexed ? 'Indexed & Ready' : 'Not Indexed'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">Methodology & Transparency</p>
              <p>
                Lead qualification uses an explainable prototype rule-based scoring rubric rather than a trained predictive ML model. Sentiment assessment analyzes conversation transcript text only and does not claim acoustic vocal emotion recognition.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
